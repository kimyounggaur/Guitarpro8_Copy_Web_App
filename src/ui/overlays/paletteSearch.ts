import type { PaletteEntry } from "../../commands/paletteCommands";

export function rankPaletteMatches(entries: PaletteEntry[], query: string): PaletteEntry[] {
  const key = query.trim().toLowerCase();
  if (!key) return entries;
  const weight = (entry: PaletteEntry) => {
    const label = entry.prefix.toLowerCase();
    const aliases = (entry.aliases ?? []).map((alias) => alias.toLowerCase());
    if (label === key) return 0;
    if (aliases.includes(key)) return 1;
    if (label.startsWith(key)) return 2;
    if (aliases.some((alias) => alias.startsWith(key))) return 3;
    if (label.includes(key)) return 4;
    return 5;
  };
  return [...entries].sort((a, b) => weight(a) - weight(b) || a.prefix.localeCompare(b.prefix, "en"));
}

export function readCommandHistory(): string[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem("tabscore.command-history") ?? "[]");
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
  } catch { return []; }
}

export function rememberCommand(input: string, history: string[]): string[] {
  const next = [input, ...history.filter((item) => item !== input)].slice(0, 20);
  try { localStorage.setItem("tabscore.command-history", JSON.stringify(next)); } catch { /* Session history remains usable. */ }
  return next;
}
