import { produce } from "immer";
import { describe, expect, it } from "vitest";
import { createBar, createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import type { Score } from "../../model/types";
import { LayoutCache } from "./layoutCache";
import { layoutScore } from "./layoutScore";

function fixture(barCount: number, trackCount: number): Score {
  const score = createEmptyScore();
  score.meta.title = "Layout equivalence";
  score.masterBars = Array.from({ length: barCount }, createMasterBar);
  score.tracks = Array.from({ length: trackCount }, (_, trackIndex) => {
    const track = createTrack(undefined, barCount);
    track.name += ` ${trackIndex + 1}`;
    for (const [barIndex, bar] of track.bars.entries()) {
      bar.voices[0].beats = Array.from({ length: 4 }, (_, beat) =>
        createBeat({ rest: false, notes: [createNote(1, (beat * 2 + barIndex + trackIndex) % 12)] })
      );
    }
    return track;
  });
  return score;
}

describe("[B18] incremental rendering equals a fresh layout", () => {
  it("holds across generated sequences of local edits, pagination changes, and inserts/removals", () => {
    const cache = new LayoutCache();
    let score = fixture(24, 3);
    let seed = 0x53369f2b;
    function next(quantity: number) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % quantity;
    }

    for (let step = 0; step < 80; step++) {
      const edit = next(14);
      const index = next(score.masterBars.length);
      const trackIndex = next(score.tracks.length);
      score = produce(score, (draft) => {
        const master = draft.masterBars[index];
        const track = draft.tracks[trackIndex];
        const bar = track.bars[index];
        if (edit === 0) bar.voices[0].beats[0].notes[0].fret = next(16);
        else if (edit === 1) bar.voices[0].beats[1].duration = 16;
        else if (edit === 2) bar.voices[0].beats[0].notes[0].tiedFromPrevious = index > 0;
        else if (edit === 3) master.layout.forcedBreak = !master.layout.forcedBreak;
        else if (edit === 4) master.timeSignature.numerator = 2 + next(5);
        else if (edit === 5) track.notationTypes = next(2) ? ["tab"] : ["standard", "tab"];
        else if (edit === 6) draft.stylesheet.page.firstSystemIndent = 12 + next(42);
        else if (edit === 7) track.tuning.capo = next(6);
        else if (edit === 8) master.anacrusis = !master.anacrusis;
        else if (edit === 9) draft.meta.title = `Changed title ${step}`;
        else if (edit === 10) track.name = `Changed track ${step}`;
        else if (edit === 11) draft.stylesheet.page.justifyLastSystem = !draft.stylesheet.page.justifyLastSystem;
        else if (edit === 12 && draft.masterBars.length > 20) {
          draft.masterBars.splice(index, 1);
          draft.tracks.forEach((candidate) => candidate.bars.splice(index, 1));
        } else if (draft.masterBars.length < 32) {
          draft.masterBars.splice(index, 0, createMasterBar());
          draft.tracks.forEach((candidate) => {
            const inserted = createBar();
            inserted.voices[0].beats = Array.from({ length: 4 }, () =>
              createBeat({ rest: false, notes: [createNote(1, 0)] })
            );
            candidate.bars.splice(index, 0, inserted);
          });
        }
      });

      const concertTone = next(3) !== 1;
      const displayMode = step % 17 === 0 ? "horizontal-screen" : step % 13 === 0 ? "vertical-screen" : "vertical-page";
      const options = { concertTone, displayMode, groupHorizontalSystems: true } as const;
      expect(layoutScore(score, { ...options, cache }), `seed step ${step}, operation ${edit}`)
        .toEqual(layoutScore(score, options));
    }
  }, 25000);

  it("reuses stable pages and updates the rendered notes after a local edit", () => {
    const score = fixture(38, 8);
    const cache = new LayoutCache();
    const first = layoutScore(score, { cache });
    expect(first.pages.length).toBeGreaterThan(1);
    const revision = produce(score, (draft) => {
      draft.tracks[0].bars.at(-1)!.voices[0].beats[0].notes[0].fret = 19;
    });
    const updated = layoutScore(revision, { cache });

    expect(updated).toEqual(layoutScore(revision));
    expect(updated.pages[0]).toBe(first.pages[0]);
    expect(updated.pages.at(-1)).not.toBe(first.pages.at(-1));
  });

  it("recomputes the preceding system when a boundary change allows one more measure to fit", () => {
    const score = fixture(12, 1);
    score.masterBars[3].layout.forcedBreak = true;
    score.masterBars[6].layout.forcedBreak = true;
    const cache = new LayoutCache();
    layoutScore(score, { cache });

    const revision = produce(score, (draft) => {
      draft.masterBars.splice(4);
      draft.tracks[0].bars.splice(4);
    });

    expect(layoutScore(revision, { cache })).toEqual(layoutScore(revision));
  });
});
