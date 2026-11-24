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
import { handleEditorKeyDown } from "../../commands/editorKeymap";
import { cursorFromHit } from "../../engine/editing/hitTest";
import {
  applyStandardInput,
  canTieFromPrevious,
  changeDurationAtCursor,
  cloneCurrentBar,
  copyPreviousBeat,
  cycleKeySignatureAtCursor,
  cycleTimeSignatureAtCursor,
  deleteBarAtCursor,
  deleteBeatAtCursor,
  deleteNoteAtCursor,
  inputFret,
  insertBarAtCursor,
  insertBeatAtCursor,
  moveCursor,
  moveNoteString,
  moveRightWithScoreMutation,
  moveStandardCursor,
  normaliseCursor,
  replaceTrackBars,
  setAccidentalAtCursor,
  setDynamicAtCursor,
  setDurationAtCursor,
  setDotsAtCursor,
  shouldMutateOnMoveRight,
  standardInputPlacement,
  tieCurrentNoteFromPrevious,
  toggleBarSymbolAtCursor,
  toggleBeatEffectAtCursor,
  toggleNoteEffectAtCursor,
  toggleRestAtCursor,
  toggleTripletAtCursor,
  transposeNoteAtCursor
} from "../../engine/editing/operations";
import type { ClipboardPayload, CursorPosition, SelectionRange } from "../../engine/editing/types";
import { createBar } from "../../model/factory";
import { DEFAULT_MAX_FRET } from "../../model/invariants";
import type { DisplayMode, Score, SongInfo, Stylesheet, StylesheetPresetName, Track } from "../../model/types";
import type { TransposeOptions } from "../../engine/tools/transpose";
import type { ChordVoicing } from "../../model/chords";
import type { RetuneMode } from "../../model/instruments";
import { usePlaybackStore, type PlaybackStatus } from "../../store/playbackStore";
import { useDocumentStore, type EditTransactionOptions } from "../../store/documentStore";
import { useViewStore } from "../../store/viewStore";
import type { AutomationLaneId } from "../../ui/shell/EditorShell";
import type { CleanupRequest } from "../../ui/shell/ToolPanels";
import type { TrackCreateOptions, TrackPanelId } from "../../ui/shell/TrackSystemPanels";
import { createScoreCrudHandlers } from "./scoreCrudHandlers";

export interface UseEditorControllerParams {
  score: Score;
  transact: (label: string, recipe: (draft: Score) => void, options?: EditTransactionOptions) => Score;
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
  editNotice: string;
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

interface FretEntry {
  digit: number;
  enteredAt: number;
  cursor: CursorPosition;
  revision: number;
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
  const [editNotice, setEditNotice] = useState("");
  const fretEntry = useRef<FretEntry | null>(null);
  const clipboardRef = useRef<ClipboardPayload | null>(null);

  function editWithCursor(
    label: string,
    recipe: (scoreDraft: Score, current: CursorPosition) => CursorPosition,
    options: { extendSelection?: boolean; coalesceRevision?: number } = {}
  ): boolean {
    setEditNotice("");
    const document = useDocumentStore.getState();
    const view = useViewStore.getState();
    let nextCursor = view.cursor;
    transact(label, (draft) => {
      nextCursor = recipe(draft, view.cursor);
    }, {
      cursorAfter: () => nextCursor,
      coalesceRevision: options.coalesceRevision
    });
    if (useDocumentStore.getState().revision === document.revision) return false;

    const current = useViewStore.getState().cursor;
    setSelection(options.extendSelection ? { anchor: view.selection?.anchor ?? view.cursor, head: current } : null);
    return true;
  }

  function updateCursorSelection(nextCursor: CursorPosition, extendSelection: boolean): void {
    const view = useViewStore.getState();
    setCursor(nextCursor);
    setSelection(extendSelection ? { anchor: view.selection?.anchor ?? view.cursor, head: nextCursor } : null);
  }

  function endFretInput(): void {
    fretEntry.current = null;
  }

  function inputFretDigit(digit: number): void {
    const enteredAt = performance.now();
    const previous = fretEntry.current;
    const revision = useDocumentStore.getState().revision;
    const current = useViewStore.getState().cursor;
    const twoDigits = previous ? previous.digit * 10 + digit : digit;
    const combine = !!previous
      && previous.revision === revision
      && previous.cursor === current
      && enteredAt - previous.enteredAt <= 300
      && twoDigits <= DEFAULT_MAX_FRET;

    endFretInput();
    const committed = editWithCursor("Input note", (draft, position) => inputFret(draft, position, combine ? twoDigits : digit), {
      coalesceRevision: combine ? revision : undefined
    });
    if (committed && !combine) {
      fretEntry.current = { digit, enteredAt, cursor: useViewStore.getState().cursor, revision: useDocumentStore.getState().revision };
    }
  }

  function copySelection(mode: "single" | "multitrack", cut: boolean): void {
    const currentScore = useDocumentStore.getState().score;
    const current = useViewStore.getState().cursor;
    const activeTrackIndex = currentScore.tracks.findIndex((track) => track.id === current.trackId);
    const barIndex = current.barIndex;

    if (mode === "single") {
      const track = currentScore.tracks[activeTrackIndex];

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
        masterBars: [currentScore.masterBars[barIndex]],
        trackBars: currentScore.tracks.map((track) => cloneCurrentBar(track, barIndex))
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
    const current = useViewStore.getState().cursor;

    transact(special ? "Special paste" : "Paste", (draft) => {
      const activeTrackIndex = draft.tracks.findIndex((track) => track.id === current.trackId);
      const data = JSON.parse(payload.barsJson) as {
        bars?: ReturnType<typeof createBar>[];
        masterBars?: typeof score.masterBars;
        trackBars?: ReturnType<typeof createBar>[];
      };

      for (let repeat = 0; repeat < repeatCount; repeat += 1) {
        const targetBar = current.barIndex + repeat;

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

  function inputStandardString(stringNumber?: number): void {
    const score = useDocumentStore.getState().score;
    const cursor = useViewStore.getState().cursor;
    const placement = standardInputPlacement(score, cursor, stringNumber === 0 ? undefined : stringNumber);
    if (!placement) {
      setEditNotice("이 음은 지금 튜닝으로 칠 수 없습니다");
      return;
    }
    editWithCursor("Input standard note", (draft, current) => applyStandardInput(draft, current, placement));
  }

  const editorContext: EditorCommandContext = {
    get staffKind() { return useViewStore.getState().cursor.staffKind; },
    get playbackStatus() { return usePlaybackStore.getState().status; },
    moveCursor: (move, extendSelection) => {
      endFretInput();
      const currentScore = useDocumentStore.getState().score;
      const current = useViewStore.getState().cursor;
      if (move === "right" && shouldMutateOnMoveRight(currentScore, current)) {
        editWithCursor("Move right and extend score", moveRightWithScoreMutation, { extendSelection });
        return;
      }

      updateCursorSelection(moveCursor(currentScore, current, move), Boolean(extendSelection));
    },
    moveBarSelection: (direction) => {
      endFretInput();
      const current = useViewStore.getState().cursor;
      const next = normaliseCursor(useDocumentStore.getState().score, {
        ...current,
        barIndex: current.barIndex + direction,
        beatIndex: 0
      });
      updateCursorSelection(next, true);
    },
    toggleStaffKind: () => {
      endFretInput();
      const current = useViewStore.getState().cursor;
      setSelection(null);
      const score = useDocumentStore.getState().score;
      setCursor(normaliseCursor(score, {
        ...current,
        writtenMidi: undefined,
        staffKind: current.staffKind === "tab" ? "standard" : "tab"
      }));
    },
    inputFretDigit,
    endFretInput,
    inputStandardString,
    changeDuration: (direction) => {
      const effective = invertPlusMinus
        ? direction === "longer"
          ? "shorter"
          : "longer"
        : direction;
      editWithCursor("Change duration", (draft, current) =>
        changeDurationAtCursor(draft, current, effective)
      );
    },
    setDuration: (duration) =>
      editWithCursor("Set duration", (draft, current) => setDurationAtCursor(draft, current, duration)),
    toggleRest: () => editWithCursor("Set rest", toggleRestAtCursor),
    toggleTie: (wholeBeat) => {
      const current = useViewStore.getState().cursor;
      if (!canTieFromPrevious(useDocumentStore.getState().score, current, wholeBeat)) {
        setEditNotice("There is no preceding note on the same string to tie.");
        return;
      }
      editWithCursor("Tie note", (draft, cursor) => tieCurrentNoteFromPrevious(draft, cursor, wholeBeat));
    },
    setDots: (dots) => editWithCursor("Set dots", (draft, current) => setDotsAtCursor(draft, current, dots)),
    toggleTriplet: () => editWithCursor("Toggle triplet", toggleTripletAtCursor),
    cycleTimeSignature: () => editWithCursor("Cycle time signature", cycleTimeSignatureAtCursor),
    cycleKeySignature: () => editWithCursor("Cycle key signature", cycleKeySignatureAtCursor),
    toggleBarSymbol: (symbol) =>
      editWithCursor("Toggle bar symbol", (draft, current) =>
        toggleBarSymbolAtCursor(draft, current, symbol)
      ),
    setDynamic: (dynamic) =>
      editWithCursor("Set dynamic", (draft, current) => setDynamicAtCursor(draft, current, dynamic)),
    toggleNoteEffect: (effect) =>
      editWithCursor("Toggle note effect", (draft, current) =>
        toggleNoteEffectAtCursor(draft, current, effect)
      ),
    toggleBeatEffect: (effect) =>
      editWithCursor("Toggle beat effect", (draft, current) =>
        toggleBeatEffectAtCursor(draft, current, effect)
      ),
    togglePlayback: (fromStart) => {
      const { status } = usePlaybackStore.getState();
      if ((status === "playing") && !fromStart) {
        stopPlayback();
        return;
      }

      void startPlayback(fromStart ? 0 : playbackCompilation.secondAtBar(useViewStore.getState().cursor.barIndex));
    },
    stopPlayback,
    movePlaybackBar: (direction) => {
      const current = useViewStore.getState().cursor;
      const next = normaliseCursor(useDocumentStore.getState().score, {
        ...current,
        barIndex: current.barIndex + direction,
        beatIndex: 0
      });
      setCursor(next);

      const { status } = usePlaybackStore.getState();
      if (status === "playing") {
        seekPlayback(playbackCompilation.secondAtBar(next.barIndex));
      }
    },
    stepPlaybackBeat: (direction) => {
      const next = moveCursor(useDocumentStore.getState().score, useViewStore.getState().cursor, direction === 1 ? "right" : "left");
      setCursor(next);

      const { status } = usePlaybackStore.getState();
      if (status === "playing") {
        seekPlayback(playbackCompilation.secondAtBar(next.barIndex));
      }
    },
    toggleLoop: togglePlaybackLoop,
    toggleMetronome,
    toggleCountIn,
    changePlaybackSpeed: (direction) => {
      setPlaybackSpeedPercent(speedPercent + direction * 5);
    },
    deleteNote: () => editWithCursor("Delete note", deleteNoteAtCursor),
    deleteBeat: () => editWithCursor("Delete beat", deleteBeatAtCursor),
    deleteBar: () => editWithCursor("Delete bar", deleteBarAtCursor),
    insertBeat: () => editWithCursor("Insert beat", insertBeatAtCursor),
    insertBar: () => editWithCursor("Insert bar", insertBarAtCursor),
    copyPreviousBeat: () => editWithCursor("Copy previous beat", copyPreviousBeat),
    moveNoteString: (direction) => {
      const cursor = useViewStore.getState().cursor;
      if (cursor.staffKind === "standard") {
        const score = useDocumentStore.getState().score;
        updateCursorSelection(moveStandardCursor(score, cursor, direction === 1 ? -1 : 1, true), false);
      } else {
        editWithCursor("Move note string", (draft, current) => moveNoteString(draft, current, direction));
      }
    },
    transposeNote: (semitones) =>
      editWithCursor("Transpose note", (draft, current) => transposeNoteAtCursor(draft, current, semitones)),
    setAccidental: (accidental) =>
      editWithCursor("Set accidental", (draft, current) =>
        setAccidentalAtCursor(draft, current, accidental)
      ),
    selectAllTrack: () => {
      const currentScore = useDocumentStore.getState().score;
      const current = useViewStore.getState().cursor;
      const anchor = normaliseCursor(currentScore, { ...current, barIndex: 0, beatIndex: 0 });
      const head = normaliseCursor(currentScore, {
        ...current,
        barIndex: Math.max(0, currentScore.masterBars.length - 1),
        beatIndex: 0
      });
      setSelection({ anchor, head });
      setCursor(head);
    },
    copy: (mode, cut) => copySelection(mode, cut),
    paste: (special) => pasteClipboard(special),
    undo: () => {
      endFretInput();
      undoDocument();
    },
    redo: () => {
      endFretInput();
      redoDocument();
    }
  };

  function handleScoreClick(event: React.MouseEvent<HTMLElement>) {
    endFretInput();
    const target = (event.target as Element).closest("[data-hit-ref]") as SVGElement | null;

    if (!target) {
      return;
    }

    const ref = JSON.parse(target.dataset.hitRef ?? "{}") as Record<string, unknown>;
    const kind = target.dataset.hitKind as Parameters<typeof cursorFromHit>[2];
    const currentScore = useDocumentStore.getState().score;
    const current = useViewStore.getState().cursor;
    // Transform the pointer back to page space so zoom and horizontal scrolling
    // do not change the staff position selected by a click.
    const transform = target.ownerSVGElement?.getScreenCTM();
    const pageY = transform && kind === "staffInput"
      ? new DOMPoint(event.clientX, event.clientY).matrixTransform(transform.inverse()).y
      : undefined;
    if (!ref.staffKind && target.id.endsWith("-head")) ref.staffKind = "standard";
    if (!ref.staffKind && target.id.endsWith("-tab")) ref.staffKind = "tab";

    const nextCursor = cursorFromHit(currentScore, current, kind, ref, pageY);
    setSelection(null);
    setCursor(nextCursor);
    if (kind === "staffInput" && pageY !== undefined) inputStandardString(nextCursor.string);
  }

  function handleScoreKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    handleEditorKeyDown(event.nativeEvent, editorContext);
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
    editNotice,
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
