import type { StemDirection, Stylesheet } from "../../model/types";

type Stem = Exclude<StemDirection, "auto">;
type VoiceStyle = Pick<Stylesheet["notation"],
  "stemDirectionVoice1" | "stemDirectionVoice2" | "restPositionVoice1" | "restPositionVoice2">;

export function chooseStemDirection(
  positions: readonly number[],
  preferred: StemDirection,
  voiceIndex: number,
  voiceCount: number,
  style: VoiceStyle
): Stem {
  if (preferred !== "auto") {
    return preferred;
  }
  if (voiceCount > 1) {
    const parity = voiceIndex % 2;
    const voiceDirection = parity === 0 ? style.stemDirectionVoice1 : style.stemDirectionVoice2;
    return voiceDirection === "auto" ? parity === 0 ? "up" : "down" : voiceDirection;
  }
  const furthest = positions.reduce((best, position) =>
    Math.abs(position - 4) > Math.abs(best - 4) ? position : best, 4);
  return furthest >= 4 ? "down" : "up";
}

export function stemEndPosition(positions: readonly number[], direction: Stem): number {
  if (direction === "up") {
    const highest = Math.max(...positions);
    return Math.max(4, highest + 7);
  }
  const lowest = Math.min(...positions);
  return Math.min(4, lowest - 7);
}

export function chordHeadOffsets(positions: readonly number[], direction: Stem, headWidth: number): number[] {
  const order = positions.map((position, index) => ({ position, index })).sort(
    (first, second) => direction === "up" ? first.position - second.position : second.position - first.position
  );
  const offsets = Array<number>(positions.length).fill(0);
  let previous: number | undefined;
  let displaced = false;
  for (const note of order) {
    displaced = previous !== undefined && Math.abs(previous - note.position) === 1 && !displaced;
    offsets[note.index] = displaced ? (direction === "up" ? headWidth : -headWidth) : 0;
    previous = note.position;
  }
  return offsets;
}

export function restStaffPosition(voiceIndex: number, voiceCount: number, style: VoiceStyle): number {
  const parity = voiceIndex % 2;
  if (voiceCount <= 1) {
    return 4;
  }
  const placement = parity === 0 ? style.restPositionVoice1 : style.restPositionVoice2;
  return placement === "above" || (placement === "auto" && parity === 0) ? 6 : 2;
}
