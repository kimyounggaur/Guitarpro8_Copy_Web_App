// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import type { Score } from "../../model/types";
import { exportMusicXml } from "./export";
import { readMusicXml } from "./import";

const names = ["note-attributes", "chord", "two-voices", "dotted-triplet", "repeats-endings", "ds-al-coda"];

function normalized(score: Score) {
  return {
    meta: score.meta,
    masterBars: score.masterBars,
    tempo: score.masterAutomations,
    tracks: score.tracks.map((track) => ({
      name: track.name, kind: track.kind, clef: track.clef,
      bars: track.bars.map((bar) => bar.voices.map(({ beats }) => beats.map((beat) => ({
        duration: beat.duration, dots: beat.dots, tuplet: beat.tuplet, rest: beat.rest,
        notes: beat.notes.map((note) => ({
          string: note.string, fret: note.fret, midiPitch: note.midiPitch, midiNumber: note.midiNumber,
          tiedFromPrevious: note.tiedFromPrevious
        }))
      }))))
    }))
  };
}

it.each(names)("[B13] normalized MusicXML round trip for %s", (name) => {
  const path = resolve(`src/test/fixtures/files/musicxml/${name}.musicxml`);
  const original = readMusicXml(readFileSync(path, "utf8")).score;
  const reparsed = readMusicXml(exportMusicXml(original));
  expect(normalized(reparsed.score)).toEqual(normalized(original));
});
