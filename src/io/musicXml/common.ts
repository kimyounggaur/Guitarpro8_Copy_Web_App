import { beatDurationTicks } from "../../model/derive";
import { createBeat } from "../../model/factory";
import { TICKS_PER_QUARTER, type Beat, type BeatDuration, type DotCount, type Tuplet } from "../../model/types";

export const BEAT_TYPES: Record<BeatDuration, string> = {
  1: "whole", 2: "half", 4: "quarter", 8: "eighth", 16: "16th", 32: "32nd", 64: "64th"
};
const DURATIONS = Object.keys(BEAT_TYPES).map(Number) as BeatDuration[];
const LETTER_PITCHES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
type Rhythm = Pick<Beat, "duration" | "dots" | "tuplet">;

export function isDuration(value: number | null): value is BeatDuration {
  return value !== null && DURATIONS.some((duration) => duration === value);
}

export function elements(parent: Element | null, name?: string): Element[] {
  if (!parent) return [];
  return Array.from(parent.children).filter((element) => name === undefined || element.localName === name);
}

export function element(parent: Element | null, name: string): Element | null {
  return elements(parent, name)[0] ?? null;
}

export function text(parent: Element | null, name: string): string | null {
  return element(parent, name)?.textContent?.trim() || null;
}

export function numeric(parent: Element | null, name: string): number | null {
  const raw = text(parent, name);
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function xmlRoot(xml: string): Element {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (!document.documentElement || document.getElementsByTagName("parsererror").length > 0) {
    throw new Error("The MusicXML document contains invalid XML.");
  }
  return document.documentElement;
}

export function readPitch(parent: Element | null, prefix = ""): number | null {
  const step = text(parent, `${prefix}step`);
  const octave = numeric(parent, `${prefix}octave`);
  const alter = numeric(parent, `${prefix}alter`) ?? 0;
  if (step === null || octave === null || !Object.prototype.hasOwnProperty.call(LETTER_PITCHES, step)) return null;
  return (octave + 1) * 12 + LETTER_PITCHES[step] + alter;
}

export function toTicks(value: number | null, divisions: number): number | null {
  if (value === null) return null;
  const ticks = Math.round((value * TICKS_PER_QUARTER) / divisions);
  return Number.isSafeInteger(ticks) ? ticks : null;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

const regularRhythms = DURATIONS.flatMap((duration) =>
  ([0, 1, 2] as DotCount[]).map((dots) => ({ duration, dots, tuplet: undefined }))
).sort((left, right) => beatDurationTicks(createBeat(right)) - beatDurationTicks(createBeat(left)));

export function rhythmForTicks(ticks: number): Rhythm {
  const duration = Math.max(1, Math.round(ticks));
  const exact = regularRhythms.find((rhythm) => beatDurationTicks(createBeat(rhythm)) === duration);
  if (exact) return exact;
  const base = DURATIONS.reduce((closest, next) =>
    Math.abs(TICKS_PER_QUARTER * 4 / next - duration) < Math.abs(TICKS_PER_QUARTER * 4 / closest - duration)
      ? next : closest
  );
  const baseTicks = TICKS_PER_QUARTER * 4 / base;
  const divisor = gcd(baseTicks, duration);
  return { duration: base, dots: 0, tuplet: { n: baseTicks / divisor, m: duration / divisor } };
}

export function parseRhythm(note: Element, divisions: number): [Rhythm, number] {
  const explicitDuration = toTicks(numeric(note, "duration"), divisions);
  const type = text(note, "type");
  const duration = DURATIONS.find((entry) => BEAT_TYPES[entry] === type);
  if (!duration) {
    const ticks = explicitDuration && explicitDuration > 0 ? explicitDuration : TICKS_PER_QUARTER;
    return [rhythmForTicks(ticks), ticks];
  }

  const dots = Math.min(2, elements(note, "dot").length) as DotCount;
  const tupletElement = element(note, "time-modification");
  const actual = numeric(tupletElement, "actual-notes");
  const normal = numeric(tupletElement, "normal-notes");
  const tuplet: Tuplet | undefined = actual && normal && actual > 0 && normal > 0 &&
    Number.isInteger(actual) && Number.isInteger(normal) ? { n: actual, m: normal } : undefined;
  const rhythm = { duration, dots, tuplet };
  return [rhythm, Math.round(explicitDuration && explicitDuration > 0 ? explicitDuration : beatDurationTicks(createBeat(rhythm)))];
}

export function silence(ticks: number): Beat[] {
  if (ticks > 16 * TICKS_PER_QUARTER) return [createBeat(rhythmForTicks(ticks))];
  const result: Beat[] = [];
  let remaining = ticks;
  while (remaining > 0) {
    const rhythm = regularRhythms.find((candidate) => beatDurationTicks(createBeat(candidate)) <= remaining)
      ?? rhythmForTicks(remaining);
    const beat = createBeat(rhythm);
    result.push(beat);
    remaining -= beatDurationTicks(beat);
  }
  return result;
}

export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;"
  })[character] ?? character);
}
