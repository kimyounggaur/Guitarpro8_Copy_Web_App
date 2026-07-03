import type { Score } from "./types";

export function createEmptyScore(): Score {
  return {
    meta: {
      title: ""
    },
    masterBars: [],
    tracks: []
  };
}
