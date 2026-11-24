import { createBeat, createEmptyScore, createMasterBar, createNote } from "../model/factory";
import { defaultDocumentView } from "../model/documentView";
import { z } from "zod";
import { version as appVersion } from "../../package.json";
import { ensureUniqueTrackIds, newId } from "../model/ids";
import { checkInvariants } from "../model/invariants";
import { INSTRUMENT_DEFINITIONS } from "../model/instruments";
import { defaultMasterMix, defaultTrackMix, normalizeVolume } from "../model/mix";
import { normalizeTies } from "../model/ties";
import { frettedMidiPitch, inferTrackNotation, isMidiPitch } from "../model/trackKind";
import type { DocumentViewSettings, Note, Score, TrackKind } from "../model/types";
import { fillMissingTrackBars, NATIVE_SCORE_FORMAT, NATIVE_SCORE_VERSION } from "./nativeScore";
import { scoreSchema } from "./scoreSchema";

export const APP_NAME = "TabScore";
export const APP_FILE_FORMAT = "tabscore/score";
export const NATIVE_EXTENSION = ".tabscore";
export const LEGACY_NATIVE_EXTENSIONS = [".gp", ".gp8"] as const;
export const NATIVE_FILE_ACCEPT = [NATIVE_EXTENSION, ...LEGACY_NATIVE_EXTENSIONS, ".json"];
export const CURRENT_SCHEMA_VERSION = 6;

export interface ScoreFileEnvelope {
  format: typeof APP_FILE_FORMAT;
  schemaVersion: number;
  app: { name: string; version: string };
  documentId: string;
  savedAt: string;
  score: ReturnType<typeof scoreForFile>;
  view: Partial<DocumentViewSettings>;
}

export interface ScoreFileReadResult {
  score: Score;
  documentId: string;
  warnings: string[];
  view: DocumentViewSettings;
  savedAt?: string;
}

const envelopeSchema = z.object({
  format: z.literal(APP_FILE_FORMAT),
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  app: z.object({ name: z.string(), version: z.string() }),
  documentId: z.string().trim().min(1),
  savedAt: z.string().datetime({ offset: true }).optional(),
  score: scoreSchema,
  view: z.object({
    zoom: z.number().finite().transform((zoom) => Math.min(300, Math.max(25, zoom))).default(defaultDocumentView.zoom),
    displayMode: z.enum(["vertical-page", "horizontal-page", "grid", "parchment", "vertical-screen", "horizontal-screen"])
      .default(defaultDocumentView.displayMode)
  }).default(defaultDocumentView)
});

interface MigrationContext {
  legacyDocumentId?: string;
  warnings: string[];
}
type Migration = (input: Record<string, unknown>, context: MigrationContext) => Record<string, unknown>;

const migrations: Partial<Record<number, Migration>> = {
  1: (input, { legacyDocumentId }) => ({
    format: APP_FILE_FORMAT,
    schemaVersion: 2,
    app: { name: typeof input.createdWith === "string" ? input.createdWith : APP_NAME, version: "1" },
    documentId: legacyDocumentId,
    savedAt: input.savedAt,
    score: input.score
  }),
  2: (input) => ({
    ...input,
    schemaVersion: 3,
    score: transformScoreNotes(input.score, ["tracks", "bars", "voices", "beats", "notes"], migrateLegacyTie)
  }),
  3: (input, { warnings }) => ({
    ...input,
    schemaVersion: 4,
    score: migrateLegacyTrackTypes(input.score, warnings)
  }),
  4: (input) => ({
    ...input,
    schemaVersion: 5,
    score: migrateMixer(input.score)
  }),
  5: (input) => {
    const score = input.score;
    if (!isRecord(score) || !isRecord(score.documentSettings)) return { ...input, schemaVersion: 6 };
    const { zoom, displayMode, ...documentSettings } = score.documentSettings;
    return { ...input, schemaVersion: 6, view: { zoom, displayMode }, score: { ...score, documentSettings } };
  }
};

function migrateMixer(value: unknown): unknown {
  if (!isRecord(value)) return value;
  return {
    ...value,
    masterMix: defaultMasterMix(),
    masterAutomations: migrateVolumeLanes(value.masterAutomations),
    masterBars: Array.isArray(value.masterBars)
      ? value.masterBars.map((bar) => isRecord(bar) ? {
          ...bar,
          tripletFeel: typeof bar.tripletFeel === "string" && bar.tripletFeel.startsWith("8th") ? "8th"
            : typeof bar.tripletFeel === "string" && bar.tripletFeel.startsWith("16th") ? "16th" : null
        } : bar)
      : value.masterBars,
    tracks: Array.isArray(value.tracks) ? value.tracks.map((track) => isRecord(track) ? {
      ...track,
      mix: defaultTrackMix(typeof track.name === "string" ? track.name : ""),
      automations: migrateVolumeLanes(track.automations)
    } : track) : value.tracks
  };
}

function migrateVolumeLanes(value: unknown): unknown {
  return Array.isArray(value) ? value.map((lane) => isRecord(lane) && lane.type === "volume" && Array.isArray(lane.points)
    ? { ...lane, points: lane.points.map((point) => isRecord(point) && typeof point.value === "number"
        ? { ...point, value: normalizeVolume(point.value) } : point) }
    : lane) : value;
}

export function writeScoreFile(
  score: Score,
  documentId: string,
  savedAt = new Date(),
  view: DocumentViewSettings = defaultDocumentView
): string {
  const envelope: ScoreFileEnvelope = {
    format: APP_FILE_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    app: { name: APP_NAME, version: appVersion },
    documentId,
    savedAt: savedAt.toISOString(),
    score: scoreForFile(score),
    view: omitDefaults(view, defaultDocumentView)
  };
  return JSON.stringify(envelope);
}

export function readScoreFile(text: string, options: { documentId?: string } = {}): ScoreFileReadResult {
  const decoded = parseJson(text);
  if (!isRecord(decoded)) {
    throw new Error("The selected file does not contain a score object.");
  }

  const { envelope, fromVersion } = identifyEnvelope(decoded);
  const warnings: string[] = [];
  const converted = migrateToCurrent(envelope, fromVersion, warnings, options.documentId);
  const parsed = envelopeSchema.safeParse(converted);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue.path.join(".") || "score file";
    throw new Error(`Invalid score file at ${field}: ${issue.message}`);
  }

  const { score, documentId, savedAt, view } = parsed.data;
  if (fromVersion === NATIVE_SCORE_VERSION) {
    const padded = fillMissingTrackBars(score);
    if (padded > 0) warnings.push(`Filled ${padded} missing track measure(s) with rests.`);
  }
  ensureUniqueTrackIds(score, warnings);

  const orphanedTies = normalizeTies(score).filter(({ code }) => code === "tie-orphan").length;
  if (orphanedTies > 0) {
    warnings.push(`Removed ${orphanedTies} tie(s) with no preceding note.`);
  }

  const issues = checkInvariants(score);
  const fatal = issues.find((issue) => issue.severity === "fatal");
  if (fatal) {
    throw new Error(`This score cannot be opened: ${fatal.message}`);
  }

  return { score, documentId, savedAt, warnings, view };
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
  warnings: string[],
  documentId?: string
): Record<string, unknown> {
  if (fromVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error("This score was saved with a newer version. Update TabScore and open the file again.");
  }

  const legacyDocumentId = fromVersion === NATIVE_SCORE_VERSION ? documentId || newId("doc") : undefined;
  let envelope = input;
  for (let version = fromVersion; version < CURRENT_SCHEMA_VERSION; version++) {
    const migration = migrations[version];
    if (!migration) {
      throw new Error(`TabScore cannot migrate score schema version ${version}.`);
    }
    envelope = migration(envelope, { legacyDocumentId, warnings });
  }
  return envelope;
}

const defaultScore = createEmptyScore();
const beatDefaults = createBeat();
const barDefaults = createMasterBar();
const { string: _defaultString, fret: _defaultFret, ...noteDefaults } = createNote();

function scoreForFile(score: Score) {
  return {
    ...omitDefaults(score, {
      meta: defaultScore.meta,
      stylesheet: defaultScore.stylesheet,
      documentSettings: defaultScore.documentSettings,
      masterMix: defaultScore.masterMix,
      masterAutomations: []
    }),
    masterBars: score.masterBars.map((bar) => omitDefaults(bar, barDefaults)),
    tracks: score.tracks.map((track) => ({
      ...omitDefaults(track, { mix: defaultTrackMix(track.name), sounds: [], chordLibrary: [], lyricsLines: [], automations: [] }),
      bars: track.bars.map((bar) => ({
        voices: bar.voices.map((voice) => ({
          beats: voice.beats.map(({ notes, ...rhythm }) => ({
            ...omitDefaults(rhythm, beatDefaults),
            ...(notes.length === 0 ? {} : { notes: notes.map((note) => noteForFile(note, track.kind)) })
          }))
        }))
      }))
    }))
  };
}

function noteForFile(note: Note, kind: TrackKind) {
  const { string, fret, midiPitch, midiNumber, ...properties } = note;
  const notation = omitDefaults(properties, noteDefaults);
  if (kind === "stringed") return { ...notation, string, fret };
  return kind === "percussion" ? { ...notation, midiNumber } : { ...notation, midiPitch };
}

function omitDefaults<T extends object>(value: T, defaults: object): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(value) as Array<keyof T>) {
    const item = value[key];
    const defaultValue = (defaults as Partial<T>)[key];
    if (!matchesDefault(item, defaultValue)) result[key] = item;
  }
  return result;
}

function matchesDefault(value: unknown, expected: unknown): boolean {
  if (value === expected) return true;
  if (Array.isArray(value) && Array.isArray(expected)) return value.length === 0 && expected.length === 0;
  if (!isRecord(value) || !isRecord(expected)) return false;
  const keys = Object.keys(value);
  return keys.length === Object.keys(expected).length && keys.every((key) => matchesDefault(value[key], expected[key]));
}

const legacyTrackIdentity = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  icon: z.string().optional(),
  staffConfig: z.enum(["single", "grand"]).optional(),
  sounds: z.array(z.object({ id: z.string() })).optional(),
  interpretation: z.object({ stringed: z.boolean().optional() }).optional(),
  tuning: z.object({
    strings: z.array(z.number()),
    capo: z.number().default(0),
    partialCapo: z.object({ fret: z.number(), strings: z.array(z.number()) }).nullable().default(null),
    label: z.string().default(""),
    accidentalPreference: z.enum(["sharp", "flat"]).default("sharp")
  })
});

function migrateLegacyTrackTypes(input: unknown, warnings: string[]): unknown {
  if (!isRecord(input) || !Array.isArray(input.tracks)) return input;

  let ambiguous = 0;
  const tracks = input.tracks.map((track: unknown) => {
    if (!isRecord(track)) return track;
    const parsed = legacyTrackIdentity.safeParse(track);
    if (!parsed.success) return track;

    const { tuning, interpretation, sounds, ...identity } = parsed.data;
    const { kind, clef, ambiguous: needsReview } = inferTrackNotation({ ...identity, stringed: interpretation?.stringed });
    const program = sounds?.find(({ id }) => /^gm-\d+$/.test(id));
    const definition = INSTRUMENT_DEFINITIONS.find((instrument) =>
      instrument.icon === identity.icon && (
        instrument.name === identity.name ||
        (program && `gm-${instrument.gmProgram}` === program.id)
      )
    );
    if (needsReview) ambiguous++;

    const updated = {
      ...track,
      kind,
      clef: kind === "percussion" ? clef : definition?.clef ?? clef,
      interpretation: { ...(isRecord(track.interpretation) ? track.interpretation : {}), stringed: kind === "stringed" }
    };

    return transformScoreNotes(updated, ["bars", "voices", "beats", "notes"], (entry) => {
      const { midiPitch, midiNumber, string, fret, ...note } = entry;
      if (kind === "stringed") return { ...note, string, fret };

      const fallBackPitch = typeof string === "number" && typeof fret === "number"
        ? frettedMidiPitch(tuning, string, fret)
        : null;
      const legacyPitch = kind === "percussion" ? midiNumber ?? midiPitch : midiPitch ?? midiNumber;
      const pitch = isMidiPitch(legacyPitch) ? legacyPitch : fallBackPitch;
      if (kind === "percussion") return { ...note, midiNumber: pitch ?? undefined };
      return { ...note, midiPitch: pitch ?? undefined };
    });
  });
  if (ambiguous > 0) {
    warnings.push(`Assigned TAB notation to ${ambiguous} track(s) with an unknown instrument type.`);
  }
  return { ...input, tracks };
}

function migrateLegacyTie(entry: Record<string, unknown>): Record<string, unknown> {
  const { tieOrigin, tieDestination: _destination, ...note } = entry;
  return isRecord(tieOrigin) ? { ...note, tiedFromPrevious: true } : note;
}

/**
 * Follow only Score's structural arrays. Malformed entries remain unchanged
 * for the schema validator to identify and report.
 */
function transformScoreNotes(
  value: unknown,
  path: string[],
  transform: (entry: Record<string, unknown>) => Record<string, unknown>
): unknown {
  if (!isRecord(value)) return value;
  const [key, ...remaining] = path;
  if (key === undefined) return transform(value);

  const entries = value[key];
  return Array.isArray(entries)
    ? { ...value, [key]: entries.map((entry) => transformScoreNotes(entry, remaining, transform)) }
    : value;
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
