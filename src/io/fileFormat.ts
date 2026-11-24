import { z } from "zod";
import { version as appVersion } from "../../package.json";
import { ensureUniqueTrackIds, newId } from "../model/ids";
import { checkInvariants } from "../model/invariants";
import type { Score } from "../model/types";
import { fillMissingTrackBars, NATIVE_SCORE_FORMAT, NATIVE_SCORE_VERSION } from "./nativeScore";
import { scoreSchema } from "./scoreSchema";

export const APP_NAME = "TabScore";
export const APP_FILE_FORMAT = "tabscore/score";
export const NATIVE_EXTENSION = ".tabscore";
export const LEGACY_NATIVE_EXTENSIONS = [".gp", ".gp8"] as const;
export const NATIVE_FILE_ACCEPT = [NATIVE_EXTENSION, ...LEGACY_NATIVE_EXTENSIONS, ".json"];
export const CURRENT_SCHEMA_VERSION = 2;

export interface ScoreFileEnvelope {
  format: typeof APP_FILE_FORMAT;
  schemaVersion: number;
  app: { name: string; version: string };
  documentId: string;
  savedAt: string;
  score: Score;
}

export interface ScoreFileReadResult {
  score: Score;
  documentId: string;
  warnings: string[];
  savedAt?: string;
}

const envelopeSchema = z.object({
  format: z.literal(APP_FILE_FORMAT),
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  app: z.object({ name: z.string(), version: z.string() }),
  documentId: z.string().trim().min(1),
  savedAt: z.string().datetime({ offset: true }).optional(),
  score: scoreSchema
});

type Migration = (input: Record<string, unknown>, documentId: string) => Record<string, unknown>;

const migrations: Partial<Record<number, Migration>> = {
  1: (input, documentId) => ({
    format: APP_FILE_FORMAT,
    schemaVersion: 2,
    app: { name: typeof input.createdWith === "string" ? input.createdWith : APP_NAME, version: "1" },
    documentId,
    savedAt: input.savedAt,
    score: input.score
  })
};

export function writeScoreFile(score: Score, documentId: string, savedAt = new Date()): string {
  const envelope: ScoreFileEnvelope = {
    format: APP_FILE_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    app: { name: APP_NAME, version: appVersion },
    documentId,
    savedAt: savedAt.toISOString(),
    score
  };
  return JSON.stringify(envelope);
}

export function readScoreFile(text: string, options: { documentId?: string } = {}): ScoreFileReadResult {
  const decoded = parseJson(text);
  if (!isRecord(decoded)) {
    throw new Error("The selected file does not contain a score object.");
  }

  const { envelope, fromVersion } = identifyEnvelope(decoded);
  const converted = migrateToCurrent(envelope, fromVersion, options.documentId);
  const parsed = envelopeSchema.safeParse(converted);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join(".") || "score file";
    throw new Error(`Invalid score file at ${field}: ${issue.message}`);
  }

  const { score, documentId, savedAt } = parsed.data;
  const warnings: string[] = [];
  if (fromVersion === NATIVE_SCORE_VERSION) {
    const padded = fillMissingTrackBars(score);
    if (padded > 0) warnings.push(`Filled ${padded} missing track measure(s) with rests.`);
  }
  ensureUniqueTrackIds(score, warnings);

  const issues = checkInvariants(score);
  const fatal = issues.find((issue) => issue.severity === "fatal");
  if (fatal) {
    throw new Error(`This score cannot be opened: ${fatal.message}`);
  }

  return { score, documentId, savedAt, warnings };
}

function identifyEnvelope(input: Record<string, unknown>) {
  if (input.format === APP_FILE_FORMAT) {
    return { envelope: input, fromVersion: readVersion(input.schemaVersion) };
  }
  if (input.format === NATIVE_SCORE_FORMAT) {
    return { envelope: input, fromVersion: readVersion(input.version) };
  }
  if (input.format === undefined && input.masterBars !== undefined && input.tracks !== undefined) {
    return { envelope: { score: input }, fromVersion: NATIVE_SCORE_VERSION };
  }
  throw new Error("This file is not a supported TabScore score.");
}

function readVersion(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error("The score file has an invalid schema version.");
  }
  return value;
}

function migrateToCurrent(
  input: Record<string, unknown>,
  fromVersion: number,
  documentId?: string
): Record<string, unknown> {
  if (fromVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error("This score was saved with a newer version. Update TabScore and open the file again.");
  }

  let envelope = input;
  for (let version = fromVersion; version < CURRENT_SCHEMA_VERSION; version++) {
    const migration = migrations[version];
    if (!migration) {
      throw new Error(`TabScore cannot migrate score schema version ${version}.`);
    }
    envelope = migration(envelope, documentId || newId("doc"));
  }
  return envelope;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text.trimStart());
  } catch {
    throw new Error("The score could not be read because it contains invalid JSON.");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
