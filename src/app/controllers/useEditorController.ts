// Editing controller — the EditorCommandContext implementation and the
// cursor/selection/edit-transaction helpers and DOM hit-testing handlers
// around it.
//
// Extracted from src/App.tsx (see docs/ui-remaster/00-component-map.md §1,
// rows App.tsx:381-559, 1423-1532 and 1534-1556) as part of Phase 2's
// structural-only refactor. Behavior is unchanged from the original.
//
// The song/track/voice/mixer/automation CRUD handlers that used to live in
// the same App.tsx region (rows 1557-1722 and 1724-2025) are built by
// `createScoreCrudHandlers` in ./scoreCrudHandlers.ts — split out once this
// file crossed the master prompt's ~500-line-per-controller guideline —
// and merged into this controller's return value below. Both known
// duplicate-logic inconsistencies from component-map.md §3 (rows 2 and 3:
// the F3/Ctrl+M keyboard shortcuts vs. the `handleToggleMulti*` wrappers)
// are preserved on purpose — see useGlobalShortcuts.ts.
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { PlaybackCompilation } from "../../engine/audio/compile";
import type { EffectSlotType, TrackMixerState } from "../../engine/audio/mixer";
import type { EditorCommandContext } from "../../commands/editingCommands";
import { handleEditorKeyDown, type FretInputBuffer } from "../../commands/editorKeymap";
import { cursorFromHit } from "../../engine/editing/hitTest";
import {
  changeDurationAtCursor,
  cloneCurrentBar,
  copyPreviousBeat,
  cycleKeySignatureAtCursor,
  cycleTimeSignatureAtCursor,
  deleteBarAtCursor,
  deleteBeatAtCursor,
  deleteNoteAtCursor,
  inputFret,
  inputStandardString,
  insertBarAtCursor,
  insertBeatAtCursor,
  moveCursor,
  moveNoteString,
  moveRightWithScoreMutation,
  normaliseCursor,
  replaceTrackBars,
  setAccidentalAtCursor,
  setDynamicAtCursor,
  setDurationAtCursor,
  setDotsAtCursor,
  shouldMutateOnMoveRight,
  tieCurrentNoteToNext,
  toggleBarSymbolAtCursor,
  toggleBeatEffectAtCursor,
  toggleNoteEffectAtCursor,
  toggleRestAtCursor,
  toggleTripletAtCursor,
  transposeNoteAtCursor
} from "../../engine/editing/operations";
import type { ClipboardPayload, CursorPosition, SelectionRange } from "../../engine/editing/types";
import { createBar } from "../../model/factory";
import type { DisplayMode, Score, SongInfo, Stylesheet, StylesheetPresetName, Track } from "../../model/types";
import type { TransposeOptions } from "../../engine/tools/transpose";
import type { ChordVoicing } from "../../model/chords";
import type { RetuneMode } from "../../model/instruments";
import type { PlaybackStatus } from "../../store/playbackStore";
import type { AutomationLaneId } from "../../ui/shell/EditorShell";
import type { CleanupRequest } from "../../ui/shell/ToolPanels";
import type { TrackCreateOptions, TrackPanelId } from "../../ui/shell/TrackSystemPanels";
import { createScoreCrudHandlers } from "./scoreCrudHandlers";

export interface UseEditorControllerParams {
  score: Score;
  transact: (label: string, recipe: (draft: Score) => void) => Score;
  undoDocument: () => Score;
  redoDocument: () => Score;
  cursor: CursorPosition;
  selection: SelectionRange | null;
  setCursor: (cursor: CursorPosition) => void;
  setSelection: (selection: SelectionRange | null) => void;
  invertPlusMinus: boolean;
  playbackStatus: PlaybackStatus;
  playbackCompilation: PlaybackCompilation;
  startPlayback: (startSec: number) => Promise<void>;
  stopPlayback: () => void;
  seekPlayback: (seconds: number) => void;
  togglePlaybackLoop: () => void;
  toggleMetronome: () => void;
  toggleCountIn: () => void;
  speedPercent: number;
  setPlaybackSpeedPercent: (speedPercent: number) => void;
  setTrackMixer: (trackId: string, patch: Partial<TrackMixerState>) => void;
  toggleTrackEffect: (trackId: string, effect: EffectSlotType) => void;
  /** Only touched by handleCreateTrack (closes the track wizard panel on
   * success) — the rest of the tool-window state is owned by
   * useToolWindowController and consumed elsewhere. */
  setActiveTrackPanel: (panel: TrackPanelId | null) => void;
}

export interface EditorController {
  editorContext: EditorCommandContext;
  multiVoiceEdit: boolean;
  multiTrackView: boolean;
  /** Raw setters, exposed alongside the `handleToggleMulti*` wrappers below
   * on purpose: the global keyboard shortcuts (F3, Ctrl+M) call these
   * directly instead of going through the wrapper handlers, duplicating
   * the toggle logic (component-map.md §3, rows 2 and 3). Preserving both
   * paths keeps this phase's diff behavior-neutral; unifying them is a
   * later-phase concern. */
  setMultiVoiceEdit: Dispatch<SetStateAction<boolean>>;
  setMultiTrackView: Dispatch<SetStateAction<boolean>>;
  editWithCursor: (label: string, recipe: (scoreDraft: Score) => CursorPosition) => void;
  handleScoreClick: (event: React.MouseEvent<HTMLElement>) => void;
  handleScoreKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void;
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
  handleToggleMultiVoice: () => void;
  handleToggleMultiTrackView: () => void;
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

export function useEditorController(params: UseEditorControllerParams): EditorController {
  const {
    score,
    transact,
    undoDocument,
    redoDocument,
    cursor,
    selection,
    setCursor,
    setSelection,
    invertPlusMinus,
    playbackStatus,
    playbackCompilation,
    startPlayback,
    stopPlayback,
    seekPlayback,
    togglePlaybackLoop,
    toggleMetronome,
    toggleCountIn,
    speedPercent,
    setPlaybackSpeedPercent,
    setTrackMixer,
    toggleTrackEffect,
    setActiveTrackPanel
  } = params;

  const [multiVoiceEdit, setMultiVoiceEdit] = useState(false);
  const [multiTrackView, setMultiTrackView] = useState(true);
  const fretBufferRef = useRef<FretInputBuffer>({ digits: "", timer: null });
  const clipboardRef = useRef<ClipboardPayload | null>(null);

  function editWithCursor(label: string, recipe: (scoreDraft: Score) => CursorPosition): void {
    let nextCursor = cursor;
    const nextScore = transact(label, (draft) => {
      nextCursor = recipe(draft);
    });
    setSelection(null);
    setCursor(normaliseCursor(nextScore, nextCursor));
  }

  function updateCursorSelection(nextCursor: CursorPosition, extendSelection: boolean): void {
    const normalised = normaliseCursor(score, nextCursor);
    setCursor(normalised);

    if (extendSelection) {
      setSelection({ anchor: selection?.anchor ?? cursor, head: normalised });
    } else {
      setSelection(null);
    }
  }

  function copySelection(mode: "single" | "multitrack", cut: boolean): void {
    const activeTrackIndex = score.tracks.findIndex((track) => track.id === cursor.trackId);
    const barIndex = cursor.barIndex;

    if (mode === "single") {
      const track = score.tracks[activeTrackIndex];

      if (!track) {
        return;
      }

      clipboardRef.current = {
        mode,
        source: null,
        barsJson: JSON.stringify({ bars: [cloneCurrentBar(track, barIndex)] })
      };

      if (cut) {
        transact("Cut bar", (draft) => {
          const draftTrack = draft.tracks[activeTrackIndex];
          if (draftTrack) {
            draftTrack.bars[barIndex] = createBar();
          }
        });
      }
      return;
    }

    clipboardRef.current = {
      mode,
      source: null,
      barsJson: JSON.stringify({
        masterBars: [score.masterBars[barIndex]],
        trackBars: score.tracks.map((track) => cloneCurrentBar(track, barIndex))
      })
    };

    if (cut) {
      transact("Cut multitrack bar", (draft) => {
        draft.tracks.forEach((track) => {
          track.bars[barIndex] = createBar();
        });
      });
    }
  }

  function pasteClipboard(special: boolean): void {
    const payload = clipboardRef.current;

    if (!payload) {
      return;
    }

    const repeatCount = special ? 2 : 1;
    const activeTrackIndex = score.tracks.findIndex((track) => track.id === cursor.trackId);

    transact(special ? "Special paste" : "Paste", (draft) => {
      const data = JSON.parse(payload.barsJson) as {
        bars?: ReturnType<typeof createBar>[];
        masterBars?: typeof score.masterBars;
        trackBars?: ReturnType<typeof createBar>[];
      };

      for (let repeat = 0; repeat < repeatCount; repeat += 1) {
        const targetBar = cursor.barIndex + repeat;

        if (payload.mode === "single" && data.bars) {
          const track = draft.tracks[activeTrackIndex];
          if (track) {
            replaceTrackBars(track, targetBar, data.bars, false);
          }
        }

        if (payload.mode === "multitrack" && data.trackBars) {
          data.masterBars?.forEach((masterBar, offset) => {
            draft.masterBars[targetBar + offset] = structuredClone(masterBar);
          });
          data.trackBars.forEach((bar, trackIndex) => {
            const track = draft.tracks[trackIndex];
            if (track) {
              replaceTrackBars(track, targetBar, [bar], false);
            }
          });
        }
      }
    });
  }

  const editorContext: EditorCommandContext = {
    staffKind: cursor.staffKind,
    playbackStatus,
    moveCursor: (move, extendSelection) => {
      if (move === "right" && shouldMutateOnMoveRight(score, cursor)) {
        let nextCursor = cursor;
        const nextScore = transact("Move right and extend score", (draft) => {
          nextCursor = moveRightWithScoreMutation(draft, cursor);
        });
        updateCursorSelection(normaliseCursor(nextScore, nextCursor), Boolean(extendSelection));
        return;
      }

      updateCursorSelection(moveCursor(score, cursor, move), Boolean(extendSelection));
    },
    moveBarSelection: (direction) => {
      const next = normaliseCursor(score, {
        ...cursor,
        barIndex: cursor.barIndex + direction,
        beatIndex: 0
      });
      setSelection({ anchor: selection?.anchor ?? cursor, head: next });
      setCursor(next);
    },
    toggleStaffKind: () => {
      if (fretBufferRef.current.timer !== null) {
        window.clearTimeout(fretBufferRef.current.timer);
      }
      fretBufferRef.current = { digits: "", timer: null };
      setSelection(null);
      setCursor({
        ...cursor,
        staffKind: cursor.staffKind === "tab" ? "standard" : "tab"
      });
    },
    inputFret: (value) => {
      editWithCursor("Input note", (draft) =>
        cursor.staffKind === "tab"
          ? inputFret(draft, cursor, value)
          : inputStandardString(draft, cursor, value)
      );
    },
    inputStandardString: (stringNumber) => {
      editWithCursor("Input standard note", (draft) =>
        inputStandardString(draft, cursor, stringNumber)
      );
    },
    changeDuration: (direction) => {
      const effective = invertPlusMinus
        ? direction === "longer"
          ? "shorter"
          : "longer"
        : direction;
      editWithCursor("Change duration", (draft) =>
        changeDurationAtCursor(draft, cursor, effective)
      );
    },
    setDuration: (duration) =>
      editWithCursor("Set duration", (draft) => setDurationAtCursor(draft, cursor, duration)),
    toggleRest: () => editWithCursor("Set rest", (draft) => toggleRestAtCursor(draft, cursor)),
    toggleTie: (wholeBeat) =>
      editWithCursor("Tie note", (draft) => tieCurrentNoteToNext(draft, cursor, wholeBeat)),
    setDots: (dots) => editWithCursor("Set dots", (draft) => setDotsAtCursor(draft, cursor, dots)),
    toggleTriplet: () =>
      editWithCursor("Toggle triplet", (draft) => toggleTripletAtCursor(draft, cursor)),
    cycleTimeSignature: () =>
      editWithCursor("Cycle time signature", (draft) =>
        cycleTimeSignatureAtCursor(draft, cursor)
      ),
    cycleKeySignature: () =>
      editWithCursor("Cycle key signature", (draft) =>
        cycleKeySignatureAtCursor(draft, cursor)
      ),
    toggleBarSymbol: (symbol) =>
      editWithCursor("Toggle bar symbol", (draft) =>
        toggleBarSymbolAtCursor(draft, cursor, symbol)
      ),
    setDynamic: (dynamic) =>
      editWithCursor("Set dynamic", (draft) => setDynamicAtCursor(draft, cursor, dynamic)),
    toggleNoteEffect: (effect) =>
      editWithCursor("Toggle note effect", (draft) =>
        toggleNoteEffectAtCursor(draft, cursor, effect)
      ),
    toggleBeatEffect: (effect) =>
      editWithCursor("Toggle beat effect", (draft) =>
        toggleBeatEffectAtCursor(draft, cursor, effect)
      ),
    togglePlayback: (fromStart) => {
      if (playbackStatus === "playing" && !fromStart) {
        stopPlayback();
        return;
      }

      void startPlayback(fromStart ? 0 : playbackCompilation.secondAtBar(cursor.barIndex));
    },
    stopPlayback,
    movePlaybackBar: (direction) => {
      const next = normaliseCursor(score, {
        ...cursor,
        barIndex: cursor.barIndex + direction,
        beatIndex: 0
      });
      setCursor(next);

      if (playbackStatus === "playing") {
        seekPlayback(playbackCompilation.secondAtBar(next.barIndex));
      }
    },
    stepPlaybackBeat: (direction) => {
      const next = moveCursor(score, cursor, direction === 1 ? "right" : "left");
      setCursor(next);

      if (playbackStatus === "playing") {
        seekPlayback(playbackCompilation.secondAtBar(next.barIndex));
      }
    },
    toggleLoop: togglePlaybackLoop,
    toggleMetronome,
    toggleCountIn,
    changePlaybackSpeed: (direction) => {
      setPlaybackSpeedPercent(speedPercent + direction * 5);
    },
    deleteNote: () => editWithCursor("Delete note", (draft) => deleteNoteAtCursor(draft, cursor)),
    deleteBeat: () => editWithCursor("Delete beat", (draft) => deleteBeatAtCursor(draft, cursor)),
    deleteBar: () => editWithCursor("Delete bar", (draft) => deleteBarAtCursor(draft, cursor)),
    insertBeat: () => editWithCursor("Insert beat", (draft) => insertBeatAtCursor(draft, cursor)),
    insertBar: () => editWithCursor("Insert bar", (draft) => insertBarAtCursor(draft, cursor)),
    copyPreviousBeat: () =>
      editWithCursor("Copy previous beat", (draft) => copyPreviousBeat(draft, cursor)),
    moveNoteString: (direction) =>
      editWithCursor("Move note string", (draft) => moveNoteString(draft, cursor, direction)),
    transposeNote: (semitones) =>
      editWithCursor("Transpose note", (draft) => transposeNoteAtCursor(draft, cursor, semitones)),
    setAccidental: (accidental) =>
      editWithCursor("Set accidental", (draft) =>
        setAccidentalAtCursor(draft, cursor, accidental)
      ),
    selectAllTrack: () => {
      const anchor = normaliseCursor(score, { ...cursor, barIndex: 0, beatIndex: 0 });
      const head = normaliseCursor(score, {
        ...cursor,
        barIndex: Math.max(0, score.masterBars.length - 1),
        beatIndex: 0
      });
      setSelection({ anchor, head });
      setCursor(head);
    },
    copy: (mode, cut) => copySelection(mode, cut),
    paste: (special) => pasteClipboard(special),
    undo: () => {
      const nextScore = undoDocument();
      setCursor(normaliseCursor(nextScore, cursor));
    },
    redo: () => {
      const nextScore = redoDocument();
      setCursor(normaliseCursor(nextScore, cursor));
    }
  };

  function handleScoreClick(event: React.MouseEvent<HTMLElement>) {
    const target = (event.target as Element).closest("[data-hit-ref]") as SVGElement | null;

    if (!target) {
      return;
    }

    const ref = JSON.parse(target.dataset.hitRef ?? "{}") as Record<string, unknown>;
    const kind = target.dataset.hitKind as Parameters<typeof cursorFromHit>[2];
    const staffKind = target.id.endsWith("-head")
      ? "standard"
      : target.id.endsWith("-tab")
        ? "tab"
        : cursor.staffKind;
    const nextCursor = cursorFromHit(score, cursor, kind, ref);
    setSelection(null);
    setCursor(normaliseCursor(score, { ...nextCursor, staffKind }));
  }

  function handleScoreKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    handleEditorKeyDown(event.nativeEvent, editorContext, fretBufferRef.current);
  }

  function handleToggleMultiVoice() {
    setMultiVoiceEdit((value) => !value);
  }

  function handleToggleMultiTrackView() {
    setMultiTrackView((value) => !value);
  }

  const crud = createScoreCrudHandlers({
    score,
    cursor,
    selection,
    transact,
    setCursor,
    setSelection,
    setMultiVoiceEdit,
    setTrackMixer,
    toggleTrackEffect,
    setActiveTrackPanel
  });

  return {
    editorContext,
    multiVoiceEdit,
    multiTrackView,
    setMultiVoiceEdit,
    setMultiTrackView,
    editWithCursor,
    handleScoreClick,
    handleScoreKeyDown,
    handleToggleMultiVoice,
    handleToggleMultiTrackView,
    ...crud
  };
}
