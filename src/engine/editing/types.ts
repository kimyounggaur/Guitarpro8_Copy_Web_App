import type { Bar, MasterBar, NoteRef, TrackKind } from "../../model/types";
import type { Clef } from "../notation/staffPosition";

export type StaffKind = "tab" | "standard";

export interface CursorPosition {
  trackId: string | null;
  barIndex: number;
  voiceIndex: number;
  beatIndex: number;
  string: number;
  staffLine: number;
  staffClef?: Clef;
  writtenMidi?: number;
  staffKind: StaffKind;
}

export interface SelectionRange {
  anchor: CursorPosition;
  head: CursorPosition;
  unit?: "bar" | "beat";
}

export interface ClipboardPayload {
  mode: "single" | "multitrack";
  source: NoteRef | null;
  wholeBars: boolean;
  masterBars: MasterBar[];
  tracks: Array<{ kind: TrackKind; bars: Bar[] }>;
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
