import type { NoteRef, Score } from "./types";

export type IdKind = "doc" | "trk";

export function newId(kind: IdKind): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const body = Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 12);
  return `${kind}_${body}`;
}

/**
 * Repair ID collisions on a newly parsed score before making it active.
 * The first occurrence keeps its original ID. Within a renamed track, links
 * that pointed to the track itself follow its new ID as well.
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

    const rewriteReference = (ref: NoteRef | undefined) => {
      if (ref?.trackId === previousId) {
        ref.trackId = nextId;
      }
    };

    for (const bar of track.bars) {
      for (const voice of bar.voices) {
        for (const beat of voice.beats) {
          for (const note of beat.notes) {
            rewriteReference(note.tieOrigin);
            rewriteReference(note.tieDestination);
          }
        }
      }
    }
  }

  if (changed > 0) {
    warnings.push(`Reassigned ${changed} missing or duplicate track ID(s).`);
  }
}
