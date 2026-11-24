import { t } from "../i18n/messages.en";
import { useLayoutEffect, useEffect, useMemo, useRef, useState } from "react";
import type { Command } from "../../commands/registry";
import {
  COMMAND_PALETTE_PLACEHOLDER,
  commandUsage,
  parsePaletteInput,
  paletteInputForEntry,
  suggestPaletteEntries,
  type PaletteEntry
} from "../../commands/paletteCommands";
import type { EditorCommandContext } from "../../commands/editingCommands";
import { OverlayPortal } from "../overlays/OverlayPortal";
import { rankPaletteMatches, readCommandHistory, rememberCommand } from "../overlays/paletteSearch";
import { shortcutLabel } from "../../commands/keymap";
import { useDialogFocus } from "../overlays/useDialogFocus";

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
  const [history, setHistory] = useState<string[]>(readCommandHistory);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [flowMode, setFlowMode] = useState(false);
  const [status, setStatus] = useState(t("palette.ready"));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const selectedByNavigation = useRef(false);
  const historyDraft = useRef("");
  const list = useRef<HTMLDivElement>(null);
  const parsed = parsePaletteInput(value);
  useDialogFocus(dialogRef, open, "native");
  const suggestions = useMemo(
    () => rankPaletteMatches(suggestPaletteEntries(value, registeredCommands as Array<Command<unknown>>),
      parsed.mode === "action" || parsed.mode === "expression" ? parsed.args : value).slice(0, 80),
    [registeredCommands, value]
  );
  const usage = commandUsage(value);
  const preview = patternPreview(value);

  useEffect(() => {
    if (open) {
      setValue(initialValue);
      setSelectedIndex(0);
      setHistoryIndex(null);
    }
  }, [initialValue, open]);

  useEffect(() => {
    setSelectedIndex(0);
    selectedByNavigation.current = false;
  }, [value]);

  useLayoutEffect(() => {
    if (!open || !dialogRef.current) return;
    const tabs = document.querySelector('[data-testid="tab-bar"]');
    const place = () => dialogRef.current?.style.setProperty("--palette-anchor", ((tabs?.getBoundingClientRect().bottom ?? 80) + 6) + "px");
    place();
    window.addEventListener("resize", place);
    const observer = new ResizeObserver(place);
    if (tabs) observer.observe(tabs);
    return () => { window.removeEventListener("resize", place); observer.disconnect(); };
  }, [open]);

  useEffect(() => {
    if (selectedByNavigation.current) list.current?.children[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) {
    return null;
  }

  function completeSuggestion(entry: PaletteEntry): void {
    const input = paletteInputForEntry(entry);
    setValue(entry.requiresArgument ? `${input} ` : input);
  }

  function run(input: string): void {
    const trimmed = input.trim();

    if (!trimmed && suggestions[0]) {
      completeSuggestion(suggestions[0]);
      return;
    }

    if (trimmed === "flow") {
      setFlowMode((enabled) => !enabled);
      setStatus(flowMode ? t("palette.flowModeOff") : t("palette.flowModeOn"));
      return;
    }

    const result = onSubmit(trimmed);
    setStatus(result.message);

    if (result.handled) {
      setHistory((items) => rememberCommand(trimmed, items));
      setHistoryIndex(null);

      if (!flowMode && !result.keepOpen) {
        onClose();
      } else {
        setValue("");
      }
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.defaultPrevented) return;
    if (event.key === "Tab" && !event.shiftKey && value.trim()) {
      const suggestion = suggestions[selectedIndex] ?? suggestions[0];

      if (suggestion && parsePaletteInput(value).prefix !== suggestion.prefix) {
        event.preventDefault();
        completeSuggestion(suggestion);
        return;
      }
    }

    const up = event.key === "ArrowUp";
    const down = event.key === "ArrowDown";
    if ((up || down) && history.length && (event.altKey || historyIndex !== null || (up && !value))) {
      event.preventDefault();
      if (historyIndex === null) historyDraft.current = value;
      const next = Math.min(history.length - 1, Math.max(-1, (historyIndex ?? -1) + (up ? 1 : -1)));
      setHistoryIndex(next < 0 ? null : next);
      setValue(next < 0 ? historyDraft.current : history[next]);
      return;
    }
    const last = Math.max(0, suggestions.length - 1);
    const index = { ArrowUp: Math.max(0, selectedIndex - 1), ArrowDown: Math.min(last, selectedIndex + 1),
      PageUp: Math.max(0, selectedIndex - 8), PageDown: Math.min(last, selectedIndex + 8), Home: 0, End: last }[event.key];
    if (index !== undefined && suggestions.length && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      selectedByNavigation.current = true;
      setSelectedIndex(index);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = suggestions[selectedIndex];
      if (selected && selectedByNavigation.current) {
        if (selected.requiresArgument) completeSuggestion(selected);
        else run(paletteInputForEntry(selected));
      } else run(event.currentTarget.value);
    }
  }

  return (
    <OverlayPortal><dialog ref={dialogRef} className="commandPalette remasteredPalette" role="dialog" aria-modal="true"
      aria-label={t("palette.commandPalette")} data-testid="command-palette" tabIndex={-1}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <div className="commandPaletteInputRow">
        <span className="commandPrompt" aria-hidden="true">{parsed.mode === "command" ? "Quick" : parsed.mode}</span>
        <input
          data-testid="command-palette-input"
          data-dialog-initial-focus
          aria-label={t("palette.searchCommands")}
          value={value}
          placeholder={COMMAND_PALETTE_PLACEHOLDER}
          onChange={(event) => { setHistoryIndex(null); setValue(event.target.value); }}
          onKeyDown={handleKeyDown}
        />
        <button type="button" aria-pressed={flowMode} className={flowMode ? "activeToggle" : ""} onClick={() => setFlowMode((enabled) => !enabled)}>
          {t("palette.flow")}
        </button>
        <button type="button" onClick={onClose} title={t("palette.closeCommandPalette")} aria-label={t("palette.closeCommandPalette")}>
          <span aria-hidden="true">×</span>
        </button>
      </div>
      <div className="commandSuggestionList" ref={list}>
        {suggestions.map((entry, index) => (
          <button
            key={`${entry.kind}-${entry.prefix}-${index}`}
            type="button"
            aria-current={index === selectedIndex}
            disabled={entry.disabled}
            onMouseEnter={() => { selectedByNavigation.current = true; setSelectedIndex(index); }}
            className={[
              "commandSuggestion",
              index === selectedIndex ? "selectedSuggestion" : "",
              entry.disabled ? "disabledSuggestion" : ""
            ].join(" ")}
            onClick={() => (entry.requiresArgument ? completeSuggestion(entry) : run(paletteInputForEntry(entry)))}
          >
            <strong>{entry.prefix}</strong>
            <span>{entry.description}</span>
            <em aria-hidden="true">{entry.disabled ? "Unavailable" : entry.requiresArgument ? "Argument ↹" : (entry.commandId && shortcutLabel(entry.commandId)) || entry.kind}</em>
          </button>
        ))}
      </div>
      <div className="commandUsageBar">
        <strong>{status}</strong>
        <span>{usage}</span>
      </div>
      {preview ? <div className="commandPatternPreview">{preview}</div> : null}
    </dialog></OverlayPortal>
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
    .map((char) => (char === " " ? t("palette.rest") : char))
    .join(" | ")}`;
}
