import type { Score } from "./types";

export type IdKind = "doc" | "trk";

export function newId(kind: IdKind): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const body = Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 12);
  return `${kind}_${body}`;
}

/**
 * Repair ID collisions on a newly parsed score before making it active.
 * The first occurrence keeps its original ID. Native ties are relative, so
 * assigning a new track ID needs no change to their notes.
 */
export function ensureUniqueTrackIds(score: Score, warnings: string[]): void {
  const originalIds = new Set(score.tracks.map((track) => track.id));
  const seenIds = new Set<string>();
  let changed = 0;

  for (const track of score.tracks) {
    const previousId = track.id;
    if (previousId.trim() && !seenIds.has(previousId)) {
      seenIds.add(previousId);
      continue;
    }

    let nextId = newId("trk");
    while (originalIds.has(nextId) || seenIds.has(nextId)) {
      nextId = newId("trk");
    }
    track.id = nextId;
    seenIds.add(nextId);
    changed++;
  }

  if (changed > 0) {
    warnings.push(`Reassigned ${changed} missing or duplicate track ID(s).`);
  }
}
