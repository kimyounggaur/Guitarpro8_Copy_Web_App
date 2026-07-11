import type { NoteRef } from "../../model/types";

export type StaffKind = "tab" | "standard";

export interface CursorPosition {
  trackId: string | null;
  barIndex: number;
  voiceIndex: number;
  beatIndex: number;
  string: number;
  staffLine: number;
  staffKind: StaffKind;
}

export interface SelectionRange {
  anchor: CursorPosition;
  head: CursorPosition;
}

export interface ClipboardPayload {
  mode: "single" | "multitrack";
  source: NoteRef | null;
  barsJson: string;
}

export type CursorMove =
  | "left"
  | "right"
  | "up"
  | "down"
  | "home"
  | "end"
  | "firstBar"
  | "lastBar"
  | "previousTrack"
  | "nextTrack";

export const VOICE_CURSOR_COLORS = ["#facc15", "#22c55e", "#f472b6", "#a78bfa"] as const;
