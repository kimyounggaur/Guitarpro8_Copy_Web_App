import type { MasterBar } from "../../model/types";
import { element, elements, numeric, text, toTicks } from "./common";

export function readBarline(barline: Element, bar: MasterBar, ending: number): number {
  const repeat = element(barline, "repeat");
  if (repeat?.getAttribute("direction") === "forward") bar.repeatOpen = true;
  if (repeat?.getAttribute("direction") === "backward") {
    const repeatCount = Number(repeat.getAttribute("times") || "2");
    bar.repeatClose = Number.isInteger(repeatCount) && repeatCount >= 2 ? repeatCount : 2;
  }

  const lineStyle = text(barline, "bar-style");
  if (lineStyle === "light-light" || lineStyle === "light-heavy") bar.doubleBar = true;

  const endings = elements(barline, "ending");
  for (const marker of endings) {
    const numbers = Array.from(marker.getAttribute("number")?.matchAll(/\d+/g) ?? []);
    const mask = numbers.reduce((bits, [match]) => {
      const value = Number(match);
      return value > 0 && value < 31 ? bits | (1 << (value - 1)) : bits;
    }, 0);
    const type = marker.getAttribute("type");
    if (type === "start" && mask) {
      bar.alternateEndings = mask;
      ending = mask;
    } else if (type === "stop" || type === "discontinue") {
      bar.alternateEndings ||= mask || ending;
      ending = 0;
    }
  }
  return ending;
}

export function readDirection(direction: Element, bar: MasterBar, divisions: number, cursor: number):
  { tick: number; bpm: number } | null {
  const sound = element(direction, "sound");
  const kinds = elements(direction, "direction-type");
  const words = kinds.flatMap((kind) => elements(kind, "words"))
    .map((word) => word.textContent?.trim()).join(" ");
  const normalized = words.toLowerCase().replace(/[.\s-]/g, "");
  const has = (name: string) => sound?.hasAttribute(name) ?? false;
  const targets = new Set(bar.directionTargets);
  const jumps = new Set(bar.directionJumps);

  if (has("segno") || kinds.some((kind) => element(kind, "segno"))) {
    targets.add(/double|second|segno2/i.test(sound?.getAttribute("segno") ?? "") ? "SegnoSegno" : "Segno");
  }
  if (has("coda") || kinds.some((kind) => element(kind, "coda"))) {
    targets.add(/double|second|coda2/i.test(sound?.getAttribute("coda") ?? "") ? "DoubleCoda" : "Coda");
  }
  if (has("fine") || normalized === "fine") targets.add("Fine");
  if (has("dacapo") || normalized.startsWith("dc") || normalized.startsWith("dacapo")) jumps.add("DaCapo");
  if (has("dalsegno") || normalized.startsWith("ds") || normalized.startsWith("dalsegno")) {
    jumps.add(/double|second|segno2/i.test(sound?.getAttribute("dalsegno") ?? "") ||
      normalized.startsWith("dss") ? "DalSegnoSegno" : "DalSegno");
  }
  if (has("tocoda") || normalized.startsWith("tocoda") || normalized === "todoublecoda") {
    jumps.add(/double|second|coda2/i.test(sound?.getAttribute("tocoda") ?? normalized) ? "DaDoubleCoda" : "DaCoda");
  }
  if (normalized.includes("aldoublecoda")) jumps.add("AlDoubleCoda");
  else if (normalized.includes("alcoda")) jumps.add("AlCoda");
  if (normalized.includes("alfine")) jumps.add("AlFine");

  const rehearsal = kinds.map((kind) => text(kind, "rehearsal")).find((entry) => entry !== null);
  if (rehearsal) {
    const [letter, ...name] = rehearsal.split(" ");
    bar.section = { letter, name: name.join(" "), boxed: true };
  }

  bar.directionTargets = [...targets];
  bar.directionJumps = [...jumps];

  const metronome = kinds.map((kind) => element(kind, "metronome")).find(Boolean) ?? null;
  const perMinute = numeric(metronome, "per-minute");
  const beatUnit = text(metronome, "beat-unit");
  const multiplier = beatUnit === "whole" ? 4 : beatUnit === "half" ? 2 : beatUnit === "eighth" ? 0.5 :
    beatUnit === "16th" ? 0.25 : 1;
  const dots = Math.min(2, elements(metronome, "beat-unit-dot").length);
  const factor = dots === 1 ? 1.5 : dots === 2 ? 1.75 : 1;
  const attribute = sound?.getAttribute("tempo");
  const bpm = attribute ? Number(attribute) : (perMinute ?? 0) * multiplier * factor;
  return Number.isFinite(bpm) && bpm > 0 ? {
    tick: cursor + (toTicks(numeric(direction, "offset"), divisions) ?? 0),
    bpm
  } : null;
}
