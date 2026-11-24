import type { KeyMode, KeySignature } from "./types";

const FIRST_FIFTH = -7;
const MAJOR_TONICS = ["Cb", "Gb", "Db", "Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#"] as const;
const MINOR_TONICS = ["Ab", "Eb", "Bb", "F", "C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#"] as const;

export function keyFifths(signature: KeySignature): number {
  const key = signature.key.trim().replace(/♭/g, "b").replace(/♯/g, "#");
  const minorTonic = key.endsWith("m");
  // Native files exported by the old MusicXML importer used the relative major's
  // name with a separate minor mode. New minor tonic names carry their suffix.
  const tonics: readonly string[] = minorTonic ? MINOR_TONICS : MAJOR_TONICS;
  const bareKey = minorTonic ? key.slice(0, -1) : key;
  const normalized = bareKey.charAt(0).toUpperCase() + bareKey.slice(1);
  const index = tonics.indexOf(normalized);
  return index === -1 ? 0 : FIRST_FIFTH + index;
}

export function keyFromFifths(fifths: number, mode: KeyMode = "major"): KeySignature {
  const index = fifths - FIRST_FIFTH;
  if (mode === "minor") {
    return { key: `${MINOR_TONICS[index] ?? "A"}m`, mode };
  }
  return { key: MAJOR_TONICS[index] ?? "C", mode };
}
