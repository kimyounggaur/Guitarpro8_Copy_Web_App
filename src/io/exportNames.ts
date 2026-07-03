import type { Score, Track } from "../model/types";

export function defaultExportName(score: Score, extension: string): string {
  return buildExportFileName("%T-%d-%h", score, score.tracks[0] ?? null, extension);
}

export function buildExportFileName(
  pattern: string,
  score: Score,
  track: Track | null,
  extension: string,
  date = new Date()
): string {
  const title = score.meta.title || "Untitled Score";
  const tokens: Record<string, string> = {
    "%T": title,
    "%t": track?.name ?? "Track",
    "%n": track ? String(Math.max(1, score.tracks.findIndex((candidate) => candidate.id === track.id) + 1)) : "1",
    "%N": String(score.tracks.length),
    "%d": date.toISOString().slice(0, 10),
    "%h": `${pad(date.getHours())}-${pad(date.getMinutes())}`
  };
  const replaced = Object.entries(tokens).reduce(
    (name, [token, value]) => name.split(token).join(value),
    pattern || "%T"
  );
  const safeName = sanitizeFileName(replaced).replace(/\.+$/, "") || "Untitled Score";
  const suffix = extension.startsWith(".") ? extension : `.${extension}`;

  return safeName.endsWith(suffix) ? safeName : `${safeName}${suffix}`;
}

export function sanitizeFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
