// Song/Track/Voice/Mixer/Automation/Tools CRUD handlers for
// useEditorController — split into its own "하위 utility" module per the
// master prompt's Phase 2 rule ("각 controller도 500줄을 넘으면 하위
// utility로 나눈다") once useEditorController.ts crossed ~500 lines.
//
// Extracted from src/App.tsx (see docs/ui-remaster/00-component-map.md §1,
// rows App.tsx:1557-1722 and App.tsx:1724-2025) as part of Phase 2's
// structural-only refactor. Behavior is unchanged from the original —
// `createScoreCrudHandlers` is called once per render from
// useEditorController (mirroring the original per-render function
// declarations) and returns the same handler set that used to live
// directly inside App().
import type { EffectSlotType, TrackMixerState } from "../../engine/audio/mixer";
import { moveRightWithScoreMutation, normaliseCursor } from "../../engine/editing/operations";
import type { CursorPosition, SelectionRange } from "../../engine/editing/types";
import { transposeScore, type TransposeOptions } from "../../engine/tools/transpose";
import { beatDurationTicks, barTheoreticalTicks } from "../../model/derive";
import { createBeat, createNote, createTrack } from "../../model/factory";
import { DRUM_MAPPINGS, instrumentById, retuneTrack, type RetuneMode } from "../../model/instruments";
import { applyStylePreset, normalizeStylesheet } from "../../model/stylesheet";
import type { ChordVoicing } from "../../model/chords";
import {
  TICKS_PER_QUARTER,
  type Automation,
  type AutomationScope,
  type AutomationType,
  type BeatDuration,
  type DisplayMode,
  type Score,
  type SongInfo,
  type Stylesheet,
  type StylesheetPresetName,
  type Track
} from "../../model/types";
import type { AutomationLaneId } from "../../ui/shell/EditorShell";
import type { CleanupRequest } from "../../ui/shell/ToolPanels";
import type { TrackCreateOptions, TrackPanelId } from "../../ui/shell/TrackSystemPanels";
import { clampNumber, ensureBeatAtCursor, selectedBarRange } from "./scoreEditingUtils";

export interface ScoreCrudDeps {
  score: Score;
  cursor: CursorPosition;
  selection: SelectionRange | null;
  transact: (label: string, recipe: (draft: Score) => void) => Score;
  setCursor: (cursor: CursorPosition) => void;
  setSelection: (selection: SelectionRange | null) => void;
  setMultiVoiceEdit: (updater: boolean | ((value: boolean) => boolean)) => void;
  setTrackMixer: (trackId: string, patch: Partial<TrackMixerState>) => void;
  toggleTrackEffect: (trackId: string, effect: EffectSlotType) => void;
  setActiveTrackPanel: (panel: TrackPanelId | null) => void;
}

export interface ScoreCrudHandlers {
  handleSongInfoChange: (field: keyof SongInfo, value: string) => void;
  handleTrackChange: (trackId: string, patch: Partial<Pick<Track, "name" | "shortName" | "color">>) => void;
  handleCreateTrack: (options: TrackCreateOptions) => void;
  handleApplyTuning: (trackId: string, tuning: Track["tuning"], mode: RetuneMode) => void;
  handleTrackSystemPatch: (trackId: string, patch: Partial<Pick<Track, "notationTypes" | "staffConfig">>) => void;
  handleTrackTranspositionChange: (trackId: string, soundingOffset: number) => void;
  handleConcertToneToggle: () => void;
  handleStylesheetChange: (stylesheet: Stylesheet) => void;
  handleStylesheetPreset: (presetName: StylesheetPresetName) => void;
  handleDisplayModeChange: (displayMode: DisplayMode) => void;
  handleZoomChange: (zoom: number) => void;
  handleTrackDelete: (trackId: string) => void;
  handleTrackMove: (trackId: string, direction: -1 | 1) => void;
  handleVoiceSelect: (voiceIndex: number) => void;
  handleMoveNoteToVoice: (voiceIndex: number) => void;
  handleDrumToggle: (mappingId: string, articulation: string) => void;
  handleGlobalJump: (trackId: string, barIndex: number) => void;
  handleMixerTrackChange: (trackId: string, patch: Partial<TrackMixerState>) => void;
  handleMixerEffectToggle: (trackId: string, effect: EffectSlotType) => void;
  handleAutomationPointSet: (lane: AutomationLaneId, tick: number, value: number) => void;
  handleAutomationPointRemove: (lane: AutomationLaneId, tick: number) => void;
  handleAutomationTransitionToggle: (lane: AutomationLaneId, tick: number) => void;
  handleInsertChordVoicing: (voicing: ChordVoicing, chordName: string) => void;
  handleFretboardNoteToggle: (string: number, fret: number, advance: boolean) => void;
  handleTransposeRequest: (options: TransposeOptions) => void;
  handleCleanupRequest: (request: CleanupRequest) => void;
}

export function createScoreCrudHandlers(deps: ScoreCrudDeps): ScoreCrudHandlers {
  const { score, cursor, selection, transact, setCursor, setSelection, setMultiVoiceEdit, setTrackMixer, toggleTrackEffect, setActiveTrackPanel } =
    deps;

  function handleSongInfoChange(field: keyof SongInfo, value: string) {
    transact("Edit song info", (draft) => {
      draft.meta[field] = value;
    });
  }

  function handleTrackChange(
    trackId: string,
    patch: Partial<Pick<Track, "name" | "shortName" | "color">>
  ) {
    transact("Edit track", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === trackId);
      if (track) {
        Object.assign(track, patch);
      }
    });
  }

  function handleCreateTrack(options: TrackCreateOptions) {
    const preset = instrumentById(options.presetId);
    let nextCursor: CursorPosition = cursor;
    const nextScore = transact("Create track", (draft) => {
      const notationTypes = options.notationTypes.length > 0 ? options.notationTypes : preset.notationTypes;
      const track = createTrack(
        {
          name: options.name.trim() || preset.name,
          shortName: options.shortName.trim() || preset.shortName,
          color: options.color,
          icon: options.icon,
          strings: [...options.tuning.strings],
          tuningLabel: options.tuning.label,
          notationTypes: [...notationTypes],
          staffConfig: options.staffConfig,
          stringed: preset.stringed,
          soundingOffset: preset.soundingOffset,
          gmProgram: preset.gmProgram
        },
        draft.masterBars.length
      );

      track.tuning = structuredClone(options.tuning);
      track.interpretation.stringed = preset.stringed;
      track.transpositionTonality.soundingOffset = preset.soundingOffset;
      draft.tracks.push(track);
      nextCursor = {
        trackId: track.id,
        barIndex: 0,
        voiceIndex: 0,
        beatIndex: 0,
        string: 1,
        staffLine: 0,
        staffKind: track.notationTypes.includes("tab") ? "tab" : "standard"
      };
    });

    setSelection(null);
    setCursor(normaliseCursor(nextScore, nextCursor));
    setActiveTrackPanel(null);
  }

  function handleApplyTuning(trackId: string, tuning: Track["tuning"], mode: RetuneMode) {
    const nextScore = transact("Apply tuning", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === trackId);

      if (track) {
        retuneTrack(track, structuredClone(tuning), mode);
      }
    });

    setCursor(normaliseCursor(nextScore, cursor));
  }

  function handleTrackSystemPatch(
    trackId: string,
    patch: Partial<Pick<Track, "notationTypes" | "staffConfig">>
  ) {
    transact("Edit track system", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === trackId);

      if (!track) {
        return;
      }

      if (patch.notationTypes && patch.notationTypes.length > 0) {
        track.notationTypes = [...patch.notationTypes];
      }

      if (patch.staffConfig) {
        track.staffConfig = patch.staffConfig;
      }
    });
  }

  function handleTrackTranspositionChange(trackId: string, soundingOffset: number) {
    transact("Edit track transposition", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === trackId);

      if (track) {
        track.transpositionTonality.soundingOffset = soundingOffset;
      }
    });
  }

  function handleConcertToneToggle() {
    transact("Toggle concert tone", (draft) => {
      draft.documentSettings.concertTone = !draft.documentSettings.concertTone;
    });
  }

  function handleStylesheetChange(stylesheet: Stylesheet) {
    transact("Edit stylesheet", (draft) => {
      draft.stylesheet = normalizeStylesheet(stylesheet);
    });
  }

  function handleStylesheetPreset(presetName: StylesheetPresetName) {
    transact("Apply stylesheet preset", (draft) => {
      draft.stylesheet = applyStylePreset(normalizeStylesheet(draft.stylesheet), presetName);
    });
  }

  function handleDisplayModeChange(displayMode: DisplayMode) {
    transact("Change display mode", (draft) => {
      draft.documentSettings.displayMode = displayMode;
    });
  }

  function handleZoomChange(zoom: number) {
    const nextZoom = clampNumber(Math.round(zoom / 5) * 5, 25, 300);

    transact("Change zoom", (draft) => {
      draft.documentSettings.zoom = nextZoom;
    });
  }

  function handleTrackDelete(trackId: string) {
    const trackIndex = score.tracks.findIndex((track) => track.id === trackId);

    if (trackIndex < 0 || score.tracks.length <= 1) {
      return;
    }

    const nextTrack = score.tracks[trackIndex + 1] ?? score.tracks[trackIndex - 1] ?? null;
    const nextScore = transact("Delete track", (draft) => {
      draft.tracks = draft.tracks.filter((track) => track.id !== trackId);
    });

    setSelection(null);
    setCursor(normaliseCursor(nextScore, { ...cursor, trackId: nextTrack?.id ?? null }));
  }

  function handleTrackMove(trackId: string, direction: -1 | 1) {
    const trackIndex = score.tracks.findIndex((track) => track.id === trackId);
    const targetIndex = Math.min(score.tracks.length - 1, Math.max(0, trackIndex + direction));

    if (trackIndex < 0 || targetIndex === trackIndex) {
      return;
    }

    const nextScore = transact("Move track", (draft) => {
      const [track] = draft.tracks.splice(trackIndex, 1);
      draft.tracks.splice(targetIndex, 0, track);
    });

    setCursor(normaliseCursor(nextScore, cursor));
  }

  function handleVoiceSelect(voiceIndex: number) {
    const nextScore = score;
    setMultiVoiceEdit(true);
    setCursor(normaliseCursor(nextScore, { ...cursor, voiceIndex }));
    setSelection(null);
  }

  function handleMoveNoteToVoice(voiceIndex: number) {
    if (voiceIndex === cursor.voiceIndex) {
      return;
    }

    let nextCursor: CursorPosition = { ...cursor, voiceIndex };
    const nextScore = transact("Move note to voice", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === cursor.trackId);
      const bar = track?.bars[cursor.barIndex];
      const sourceVoice = bar?.voices[cursor.voiceIndex];
      const targetVoice = bar?.voices[voiceIndex];
      const sourceBeat = sourceVoice?.beats[cursor.beatIndex];

      if (!sourceBeat || !targetVoice || sourceBeat.notes.length === 0) {
        return;
      }

      while (targetVoice.beats.length <= cursor.beatIndex) {
        targetVoice.beats.push(createBeat({ duration: sourceBeat.duration, dots: sourceBeat.dots, rest: true }));
      }

      const targetBeat = targetVoice.beats[cursor.beatIndex];
      const noteIndex = Math.max(0, sourceBeat.notes.findIndex((note) => note.string === cursor.string));
      const [note] = sourceBeat.notes.splice(noteIndex, 1);

      if (!note) {
        return;
      }

      targetBeat.rest = false;
      targetBeat.notes.push(note);

      if (sourceBeat.notes.length === 0) {
        sourceBeat.rest = true;
      }

      nextCursor = { ...cursor, voiceIndex, string: note.string };
    });

    setMultiVoiceEdit(true);
    setSelection(null);
    setCursor(normaliseCursor(nextScore, nextCursor));
  }

  function handleDrumToggle(mappingId: string, articulation: string) {
    const mapping = DRUM_MAPPINGS.find((candidate) => candidate.id === mappingId);
    const activeTrack = score.tracks.find((track) => track.id === cursor.trackId);

    if (!mapping || activeTrack?.icon !== "drums") {
      return;
    }

    const nextScore = transact("Toggle drum hit", (draft) => {
      const beat = ensureBeatAtCursor(draft, cursor);

      if (!beat) {
        return;
      }

      const existingIndex = beat.notes.findIndex(
        (note) => note.midiNumber === mapping.midiNumber && note.articulation === articulation
      );

      if (existingIndex >= 0) {
        beat.notes.splice(existingIndex, 1);
      } else {
        const note = createNote(1, 0);
        note.midiNumber = mapping.midiNumber;
        note.articulation = articulation;
        note.ghost = articulation === "ghost";
        note.accent = articulation === "accent" || articulation === "rimshot" ? "accent" : "none";
        beat.notes.push(note);
      }

      beat.rest = beat.notes.length === 0;
    });

    setCursor(normaliseCursor(nextScore, cursor));
  }

  function handleGlobalJump(trackId: string, barIndex: number) {
    setSelection(null);
    setCursor(
      normaliseCursor(score, {
        ...cursor,
        trackId,
        barIndex,
        beatIndex: 0
      })
    );
  }

  function handleMixerTrackChange(trackId: string, patch: Partial<TrackMixerState>) {
    setTrackMixer(trackId, patch);
  }

  function handleMixerEffectToggle(trackId: string, effect: EffectSlotType) {
    toggleTrackEffect(trackId, effect);
  }

  function handleAutomationPointSet(lane: AutomationLaneId, tick: number, value: number) {
    transact("Edit automation", (draft) => {
      const target = automationTarget(draft, lane, cursor.trackId);

      if (!target) {
        return;
      }

      const automation = ensureAutomation(target.automations, target.type, target.scope);
      const snappedTick = snapAutomationTick(tick);
      const existing = nearestAutomationPoint(automation, snappedTick);

      if (existing && Math.abs(existing.tick - snappedTick) <= TICKS_PER_QUARTER / 4) {
        existing.tick = snappedTick;
        existing.value = value;
      } else {
        automation.points.push({ tick: snappedTick, value, transition: "constant" });
      }

      automation.points.sort((left, right) => left.tick - right.tick);
    });
  }

  function handleAutomationPointRemove(lane: AutomationLaneId, tick: number) {
    transact("Remove automation point", (draft) => {
      const target = automationTarget(draft, lane, cursor.trackId);

      if (!target) {
        return;
      }

      const automation = target.automations.find(
        (candidate) => candidate.type === target.type && candidate.scope === target.scope
      );

      if (!automation) {
        return;
      }

      const snappedTick = snapAutomationTick(tick);
      automation.points = automation.points.filter(
        (point) => Math.abs(point.tick - snappedTick) > TICKS_PER_QUARTER / 4
      );
    });
  }

  function handleAutomationTransitionToggle(lane: AutomationLaneId, tick: number) {
    transact("Toggle automation transition", (draft) => {
      const target = automationTarget(draft, lane, cursor.trackId);

      if (!target) {
        return;
      }

      const automation = target.automations.find(
        (candidate) => candidate.type === target.type && candidate.scope === target.scope
      );
      const point = automation ? nearestAutomationPoint(automation, snapAutomationTick(tick)) : null;

      if (point) {
        point.transition = point.transition === "constant" ? "progressive" : "constant";
      }
    });
  }

  function handleInsertChordVoicing(voicing: ChordVoicing, chordName: string) {
    let nextCursor = cursor;
    const nextScore = transact("Insert chord voicing", (draft) => {
      const beat = ensureBeatAtCursor(draft, cursor);
      const track = draft.tracks.find((candidate) => candidate.id === cursor.trackId);

      if (!beat || !track) {
        return;
      }

      beat.rest = false;
      beat.chordId = chordName;
      beat.notes = voicing.notes.map((voicingNote) => createNote(voicingNote.string, voicingNote.fret));

      if (!track.chordLibrary.some((chord) => chord.id === chordName)) {
        track.chordLibrary.push({ id: chordName, name: chordName });
      }

      nextCursor = {
        ...cursor,
        string: voicing.notes[0]?.string ?? cursor.string
      };
    });

    setCursor(normaliseCursor(nextScore, nextCursor));
  }

  function handleFretboardNoteToggle(string: number, fret: number, advance: boolean) {
    let nextCursor = { ...cursor, string };
    const nextScore = transact("Fretboard note input", (draft) => {
      const beat = ensureBeatAtCursor(draft, { ...cursor, string });

      if (!beat) {
        return;
      }

      const existingIndex = beat.notes.findIndex((note) => note.string === string && note.fret === fret);

      if (existingIndex >= 0) {
        beat.notes.splice(existingIndex, 1);
      } else {
        beat.rest = false;
        const sameStringIndex = beat.notes.findIndex((note) => note.string === string);
        const note = createNote(string, fret);

        if (sameStringIndex >= 0) {
          beat.notes[sameStringIndex] = note;
        } else {
          beat.notes.push(note);
        }
      }

      if (beat.notes.length === 0) {
        beat.rest = true;
      }

      if (advance) {
        nextCursor = moveRightWithScoreMutation(draft, { ...cursor, string });
      }
    });

    setCursor(normaliseCursor(nextScore, nextCursor));
  }

  function handleTransposeRequest(options: TransposeOptions) {
    const nextScore = transact("Transpose", (draft) => {
      transposeScore(draft, cursor, selection, options);
    });
    setCursor(normaliseCursor(nextScore, cursor));
  }

  function handleCleanupRequest(request: CleanupRequest) {
    const nextScore = transact("Tools cleanup", (draft) => {
      const track = draft.tracks.find((candidate) => candidate.id === cursor.trackId);

      if (!track) {
        return;
      }

      const { start, end } = selectedBarRange(draft, cursor, selection);

      for (let barIndex = start; barIndex <= end; barIndex += 1) {
        const bar = track.bars[barIndex];

        if (!bar) {
          continue;
        }

        bar.voices.forEach((voice) => {
          voice.beats.forEach((beat) => {
            beat.notes.forEach((note) => {
              if (request === "letRing") {
                note.letRing = true;
                note.palmMute = false;
              }

              if (request === "palmMute") {
                note.palmMute = true;
                note.letRing = false;
              }

              if (request === "fingerPositioning" && note.fret > 12) {
                note.fret -= 12;
              }
            });
          });

          if (request === "completeRests") {
            const expected = draft.masterBars[barIndex] ? barTheoreticalTicks(draft.masterBars[barIndex]) : 0;
            const actual = voice.beats.reduce((sum, beat) => sum + beatDurationTicks(beat), 0);
            const remaining = expected - actual;

            if (remaining > 0) {
              voice.beats.push(createBeat({ duration: durationForTicks(remaining), rest: true }));
            }
          }
        });
      }
    });

    setCursor(normaliseCursor(nextScore, cursor));
  }

  return {
    handleSongInfoChange,
    handleTrackChange,
    handleCreateTrack,
    handleApplyTuning,
    handleTrackSystemPatch,
    handleTrackTranspositionChange,
    handleConcertToneToggle,
    handleStylesheetChange,
    handleStylesheetPreset,
    handleDisplayModeChange,
    handleZoomChange,
    handleTrackDelete,
    handleTrackMove,
    handleVoiceSelect,
    handleMoveNoteToVoice,
    handleDrumToggle,
    handleGlobalJump,
    handleMixerTrackChange,
    handleMixerEffectToggle,
    handleAutomationPointSet,
    handleAutomationPointRemove,
    handleAutomationTransitionToggle,
    handleInsertChordVoicing,
    handleFretboardNoteToggle,
    handleTransposeRequest,
    handleCleanupRequest
  };
}

function automationTarget(score: Score, lane: AutomationLaneId, trackId: string | null) {
  if (lane === "tempo") {
    return { automations: score.masterAutomations, type: "tempo" as AutomationType, scope: "master" as AutomationScope };
  }

  if (lane === "masterVolume") {
    return { automations: score.masterAutomations, type: "volume" as AutomationType, scope: "master" as AutomationScope };
  }

  if (lane === "masterPan") {
    return { automations: score.masterAutomations, type: "pan" as AutomationType, scope: "master" as AutomationScope };
  }

  const track = score.tracks.find((candidate) => candidate.id === trackId);

  if (!track) {
    return null;
  }

  return {
    automations: track.automations,
    type: lane === "trackVolume" ? "volume" as AutomationType : "pan" as AutomationType,
    scope: "track" as AutomationScope
  };
}

function ensureAutomation(
  automations: Automation[],
  type: AutomationType,
  scope: AutomationScope
): Automation {
  let automation = automations.find((candidate) => candidate.type === type && candidate.scope === scope);

  if (!automation) {
    automation = { type, scope, points: [] };
    automations.push(automation);
  }

  return automation;
}

function nearestAutomationPoint(automation: Automation, tick: number) {
  return automation.points.reduce<(typeof automation.points)[number] | null>((nearest, point) => {
    if (!nearest || Math.abs(point.tick - tick) < Math.abs(nearest.tick - tick)) {
      return point;
    }

    return nearest;
  }, null);
}

function snapAutomationTick(tick: number): number {
  return Math.max(0, Math.round(tick / TICKS_PER_QUARTER) * TICKS_PER_QUARTER);
}

function durationForTicks(ticks: number): BeatDuration {
  const candidates: Array<[BeatDuration, number]> = [
    [1, TICKS_PER_QUARTER * 4],
    [2, TICKS_PER_QUARTER * 2],
    [4, TICKS_PER_QUARTER],
    [8, TICKS_PER_QUARTER / 2],
    [16, TICKS_PER_QUARTER / 4],
    [32, TICKS_PER_QUARTER / 8],
    [64, TICKS_PER_QUARTER / 16]
  ];
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate[1] - ticks) < Math.abs(best[1] - ticks) ? candidate : best
  )[0];
}
