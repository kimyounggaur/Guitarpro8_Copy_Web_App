import { createEmptyScore } from "../model/factory";
import { normalizeStylesheet } from "../model/stylesheet";
import type { DocumentSettings, Score } from "../model/types";

export const NATIVE_SCORE_FORMAT = "guitar-pro-clone/native-score";
export const NATIVE_SCORE_VERSION = 1;

export interface NativeScoreEnvelope {
  format: typeof NATIVE_SCORE_FORMAT;
  version: typeof NATIVE_SCORE_VERSION;
  createdWith: string;
  savedAt: string;
  score: Score;
}

export function serializeNativeScore(score: Score, savedAt = new Date()): string {
  const envelope: NativeScoreEnvelope = {
    format: NATIVE_SCORE_FORMAT,
    version: NATIVE_SCORE_VERSION,
    createdWith: "GuitarPro8 Copy Web App",
    savedAt: savedAt.toISOString(),
    score: normalizeScoreForIo(score)
  };

  return `${JSON.stringify(envelope, null, 2)}\n`;
}

export function parseNativeScore(text: string): Score {
  const parsed = JSON.parse(text) as Partial<NativeScoreEnvelope> | Score;
  const score = isNativeEnvelope(parsed) ? parsed.score : parsed;

  if (!isScoreLike(score)) {
    throw new Error("The selected file is not a GuitarPro8 Copy score.");
  }

  return normalizeScoreForIo(score);
}

export function normalizeScoreForIo(score: Score): Score {
  const fallback = createEmptyScore();
  const normalized: Score = {
    ...fallback,
    ...structuredClone(score),
    meta: {
      ...fallback.meta,
      ...(score.meta ?? {})
    },
    masterBars: Array.isArray(score.masterBars) ? structuredClone(score.masterBars) : fallback.masterBars,
    tracks: Array.isArray(score.tracks) ? structuredClone(score.tracks) : fallback.tracks,
    stylesheet: normalizeStylesheet(score.stylesheet),
    documentSettings: normalizeDocumentSettings(score.documentSettings),
    masterAutomations: Array.isArray(score.masterAutomations)
      ? structuredClone(score.masterAutomations)
      : []
  };

  normalized.tracks.forEach((track) => {
    while (track.bars.length < normalized.masterBars.length) {
      track.bars.push(structuredClone(track.bars[track.bars.length - 1] ?? { voices: [{ beats: [] }, { beats: [] }, { beats: [] }, { beats: [] }] }));
    }
  });

  return normalized;
}

function normalizeDocumentSettings(settings: DocumentSettings | undefined): DocumentSettings {
  const fallback = createEmptyScore().documentSettings;

  return {
    ...fallback,
    ...(settings ?? {}),
    zoom: clampNumber(settings?.zoom ?? fallback.zoom, 25, 300)
  };
}

function isNativeEnvelope(value: unknown): value is NativeScoreEnvelope {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Partial<NativeScoreEnvelope>).format === NATIVE_SCORE_FORMAT &&
    (value as Partial<NativeScoreEnvelope>).version === NATIVE_SCORE_VERSION
  );
}

function isScoreLike(value: unknown): value is Score {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as Score).masterBars) &&
    Array.isArray((value as Score).tracks)
  );
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
