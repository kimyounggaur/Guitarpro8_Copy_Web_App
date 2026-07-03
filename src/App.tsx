import { useEffect, useMemo, useRef, useState } from "react";
import { ensureDemoCommandsRegistered } from "./commands/demoCommands";
import {
  ensureEditingCommandsRegistered,
  type EditorCommandContext
} from "./commands/editingCommands";
import {
  handleEditorKeyDown,
  type FretInputBuffer
} from "./commands/editorKeymap";
import { executeCommand } from "./commands/registry";
import { compilePlayback, type NoteEvent, type PlaybackCompilation } from "./engine/audio/compile";
import { PlaybackScheduler } from "./engine/audio/scheduler";
import type { EffectSlotType, TrackMixerState } from "./engine/audio/mixer";
import { beatDurationTicks, barTheoreticalTicks } from "./model/derive";
import { cursorFromHit } from "./engine/editing/hitTest";
import {
  changeDurationAtCursor,
  cloneCurrentBar,
  copyPreviousBeat,
  cycleKeySignatureAtCursor,
  cycleTimeSignatureAtCursor,
  defaultCursor,
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
} from "./engine/editing/operations";
import { withEditorOverlays } from "./engine/editing/overlays";
import type { ClipboardPayload, CursorMove, CursorPosition, SelectionRange } from "./engine/editing/types";
import { layoutScore } from "./engine/layout/layoutScore";
import { transposeScore, type TransposeOptions } from "./engine/tools/transpose";
import { unrollScore } from "./engine/unroll/unrollScore";
import { createBar, createBeat, createNote } from "./model/factory";
import type { ChordVoicing } from "./model/chords";
import { TICKS_PER_QUARTER, type Automation, type AutomationScope, type AutomationType, type BeatDuration, type Score, type SongInfo, type Track } from "./model/types";
import { SvgRenderer } from "./engine/render/SvgRenderer";
import { createDemoScore } from "./model/demoScore";
import { useDocumentStore } from "./store/documentStore";
import { usePlaybackStore } from "./store/playbackStore";
import { usePreferencesStore } from "./store/preferencesStore";
import { useViewStore } from "./store/viewStore";
import { EditorShell, type AutomationLaneId } from "./ui/shell/EditorShell";
import type { CleanupRequest, ToolPanelId } from "./ui/shell/ToolPanels";

function App() {
  ensureDemoCommandsRegistered();
  ensureEditingCommandsRegistered();

  const score = useDocumentStore((state) => state.score);
  const dirty = useDocumentStore((state) => state.dirty);
  const documents = useDocumentStore((state) => state.documents);
  const activeId = useDocumentStore((state) => state.activeId);
  const undoCount = useDocumentStore((state) => state.undoStack.length);
  const redoCount = useDocumentStore((state) => state.redoStack.length);
  const loadScore = useDocumentStore((state) => state.loadScore);
  const transact = useDocumentStore((state) => state.transact);
  const undoDocument = useDocumentStore((state) => state.undo);
  const redoDocument = useDocumentStore((state) => state.redo);
  const cursor = useViewStore((state) => state.cursor);
  const selection = useViewStore((state) => state.selection);
  const setCursor = useViewStore((state) => state.setCursor);
  const setSelection = useViewStore((state) => state.setSelection);
  const playbackStatus = usePlaybackStore((state) => state.status);
  const playbackBarIndex = usePlaybackStore((state) => state.currentBarIndex);
  const playbackTick = usePlaybackStore((state) => state.currentTick);
  const playbackTimeSec = usePlaybackStore((state) => state.currentTimeSec);
  const loopEnabled = usePlaybackStore((state) => state.loopEnabled);
  const metronomeEnabled = usePlaybackStore((state) => state.metronomeEnabled);
  const countInEnabled = usePlaybackStore((state) => state.countInEnabled);
  const speedPercent = usePlaybackStore((state) => state.speedPercent);
  const mixer = usePlaybackStore((state) => state.mixer);
  const setPlaybackStatus = usePlaybackStore((state) => state.setStatus);
  const setPlaybackPosition = usePlaybackStore((state) => state.setPosition);
  const togglePlaybackLoop = usePlaybackStore((state) => state.toggleLoop);
  const toggleMetronome = usePlaybackStore((state) => state.toggleMetronome);
  const toggleCountIn = usePlaybackStore((state) => state.toggleCountIn);
  const setPlaybackSpeedPercent = usePlaybackStore((state) => state.setSpeedPercent);
  const syncMixerTracks = usePlaybackStore((state) => state.syncMixerTracks);
  const setTrackMixer = usePlaybackStore((state) => state.setTrackMixer);
  const setMasterFocusPercent = usePlaybackStore((state) => state.setMasterFocusPercent);
  const toggleTrackEffect = usePlaybackStore((state) => state.toggleTrackEffect);
  const invertPlusMinus = usePreferencesStore((state) => state.invertPlusMinus);
  const panelVisibility = usePreferencesStore((state) => state.panelVisibility);
  const togglePanel = usePreferencesStore((state) => state.togglePanel);
  const demoScore = useMemo(() => createDemoScore(), []);
  const [activeToolPanel, setActiveToolPanel] = useState<ToolPanelId | null>(null);
  const fretBufferRef = useRef<FretInputBuffer>({ digits: "", timer: null });
  const clipboardRef = useRef<ClipboardPayload | null>(null);
  const schedulerRef = useRef<PlaybackScheduler | null>(null);

  useEffect(() => {
    if (score.tracks.length === 0) {
      loadScore(demoScore);
      setCursor(defaultCursor(demoScore));
    }
  }, [demoScore, loadScore, score.tracks.length, setCursor]);

  useEffect(() => {
    return () => schedulerRef.current?.stop("manual");
  }, []);

  useEffect(() => {
    syncMixerTracks(score.tracks);
  }, [score.tracks, syncMixerTracks]);

  const playbackCompilation = useMemo(
    () =>
      compilePlayback(
        score,
        unrollScore(score),
        {
          mode: "relative",
          percent: speedPercent
        },
        mixer,
        cursor.trackId
      ),
    [score, speedPercent, mixer, cursor.trackId]
  );

  const baseScene = useMemo(
    () =>
      layoutScore(score, {
        editingBar: { barIndex: cursor.barIndex, trackId: cursor.trackId ?? undefined }
      }),
    [score, cursor]
  );
  const scene = useMemo(
    () =>
      withEditorOverlays(
        baseScene,
        cursor,
        selection,
        playbackStatus === "playing" ? playbackBarIndex : null
      ),
    [baseScene, cursor, playbackBarIndex, playbackStatus, selection]
  );

  useEffect(() => {
    function handlePanelShortcuts(event: KeyboardEvent) {
      const panelByKey = {
        F2: "palette",
        F5: "songInspector",
        F6: "trackInspector",
        F8: "globalView",
        F10: "automationView"
      } as const;
      const panel = panelByKey[event.key as keyof typeof panelByKey];

      if (panel) {
        event.preventDefault();
        togglePanel(panel);
      }
    }

    window.addEventListener("keydown", handlePanelShortcuts);
    return () => window.removeEventListener("keydown", handlePanelShortcuts);
  }, [togglePanel]);

  useEffect(() => {
    function handleToolShortcuts(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editingText =
        target?.tagName === "INPUT" ||
        target?.tagName === "SELECT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (editingText) {
        return;
      }

      const ctrl = event.ctrlKey || event.metaKey;

      if (event.key === "Escape" && activeToolPanel) {
        event.preventDefault();
        setActiveToolPanel(null);
        return;
      }

      if (!ctrl && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setActiveToolPanel("chords");
        return;
      }

      if (!ctrl && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        setActiveToolPanel("scales");
        return;
      }

      if (ctrl && event.key === "F6") {
        event.preventDefault();
        setActiveToolPanel("instrument");
        return;
      }

      if (event.key === "F4") {
        event.preventDefault();
        setActiveToolPanel("cleanup");
      }
    }

    window.addEventListener("keydown", handleToolShortcuts, { capture: true });
    return () => window.removeEventListener("keydown", handleToolShortcuts, { capture: true });
  }, [activeToolPanel]);

  const editorContext = useMemo<EditorCommandContext>(
    () => ({
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
          schedulerRef.current?.seek(playbackCompilation.secondAtBar(next.barIndex));
        }
      },
      stepPlaybackBeat: (direction) => {
        const next = moveCursor(score, cursor, direction === 1 ? "right" : "left");
        setCursor(next);

        if (playbackStatus === "playing") {
          schedulerRef.current?.seek(playbackCompilation.secondAtBar(next.barIndex));
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
    }),
    [
      clipboardRef,
      cursor,
      invertPlusMinus,
      playbackCompilation,
      playbackStatus,
      redoDocument,
      score,
      selection,
      setPlaybackSpeedPercent,
      setCursor,
      setSelection,
      speedPercent,
      transact,
      toggleCountIn,
      toggleMetronome,
      togglePlaybackLoop,
      undoDocument
    ]
  );

  function dispatchEditorCommand(commandId: string): void {
    executeCommand(commandId, editorContext);
  }

  async function startPlayback(startSec: number): Promise<void> {
    const scheduler = schedulerRef.current ?? new PlaybackScheduler();
    schedulerRef.current = scheduler;
    const countInSeconds = countInEnabled ? countInDurationSeconds(playbackCompilation) : 0;
    const events = playbackEvents(playbackCompilation, {
      metronome: metronomeEnabled,
      countIn: countInEnabled,
      startSec,
      countInSeconds
    });

    setPlaybackStatus("playing");

    try {
      await scheduler.play({
        startSec: startSec - countInSeconds,
        totalSeconds: playbackCompilation.totalSeconds,
        events,
        onPosition: ({ timeSec }) => {
          const position = playbackCompilation.positionAtSecond(Math.max(0, timeSec));
          setPlaybackPosition({
            barIndex: position.barIndex,
            tick: position.tick,
            timeSec: position.timeSec
          });
        },
        onStop: (reason) => {
          setPlaybackStatus("stopped");

          if (reason === "ended" && loopEnabled) {
            window.setTimeout(() => {
              void startPlayback(loopStartSecond(playbackCompilation, selection, cursor.barIndex));
            }, 0);
          }
        }
      });
    } catch {
      setPlaybackStatus("stopped");
    }
  }

  function stopPlayback(): void {
    schedulerRef.current?.stop("manual");
    setPlaybackStatus("stopped");
  }

  function editWithCursor(
    label: string,
    recipe: (scoreDraft: typeof score) => CursorPosition
  ): void {
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

  return (
    <EditorShell
      score={score}
      cursor={cursor}
      dirty={dirty}
      undoCount={undoCount}
      redoCount={redoCount}
      documents={documents}
      activeId={activeId}
      panelVisibility={panelVisibility}
      playbackStatus={playbackStatus}
      playbackBarIndex={playbackBarIndex}
      playbackTick={playbackTick}
      playbackTimeSec={playbackTimeSec}
      loopEnabled={loopEnabled}
      metronomeEnabled={metronomeEnabled}
      countInEnabled={countInEnabled}
      speedPercent={speedPercent}
      mixer={mixer}
      activeToolPanel={activeToolPanel}
      dispatchCommand={dispatchEditorCommand}
      togglePanel={togglePanel}
      onSongInfoChange={handleSongInfoChange}
      onTrackChange={handleTrackChange}
      onGlobalJump={handleGlobalJump}
      onMixerTrackChange={handleMixerTrackChange}
      onMixerEffectToggle={handleMixerEffectToggle}
      onMasterFocusChange={setMasterFocusPercent}
      onAutomationPointSet={handleAutomationPointSet}
      onAutomationPointRemove={handleAutomationPointRemove}
      onAutomationTransitionToggle={handleAutomationTransitionToggle}
      onToolOpen={setActiveToolPanel}
      onToolClose={() => setActiveToolPanel(null)}
      onInsertChordVoicing={handleInsertChordVoicing}
      onFretboardNoteToggle={handleFretboardNoteToggle}
      onTransposeRequest={handleTransposeRequest}
      onCleanupRequest={handleCleanupRequest}
      workspace={
        <div
          className="scoreViewport"
          tabIndex={0}
          role="application"
          aria-label="Editable score"
          onClick={handleScoreClick}
          onKeyDown={handleScoreKeyDown}
        >
          <SvgRenderer scene={scene} />
        </div>
      }
    />
  );
}

function playbackEvents(
  compilation: PlaybackCompilation,
  options: { metronome: boolean; countIn: boolean; startSec: number; countInSeconds: number }
): NoteEvent[] {
  const events = [...compilation.events];

  if (options.metronome) {
    compilation.segments.forEach((segment) => {
      for (let tick = segment.startTick; tick < segment.startTick + segment.durationTicks; tick += 480) {
        events.push(clickEvent(`metronome-${segment.sequenceIndex}-${tick}`, compilation.tempoMap.ticksToSeconds(tick), tick === segment.startTick));
      }
    });
  }

  if (options.countIn) {
    const beatLength = options.countInSeconds / 4;

    for (let beat = 0; beat < 4; beat += 1) {
      events.push(
        clickEvent(
          `count-in-${beat}`,
          options.startSec - options.countInSeconds + beat * beatLength,
          beat === 0
        )
      );
    }
  }

  return events.sort((left, right) => left.timeSec - right.timeSec);
}

function clickEvent(id: string, timeSec: number, downbeat: boolean): NoteEvent {
  return {
    id,
    timeSec,
    durationSec: 0.035,
    startTick: 0,
    writtenTick: 0,
    durationTicks: 24,
    midiPitch: downbeat ? 96 : 84,
    velocity: downbeat ? 108 : 78,
    trackId: "__metronome__",
    barIndex: 0,
    voiceIndex: 0,
    beatIndex: 0,
    noteIndex: 0,
    string: 0,
    effects: {
      dead: false,
      ghost: false,
      palmMute: true,
      letRing: false,
      staccato: true,
      accent: downbeat ? "heavy" : "none",
      vibrato: "none",
      hopo: false,
      fadeIn: false,
      fadeOut: false,
      volumeSwell: false,
      slap: false,
      pop: false,
      deadSlapped: false,
      pickscrape: false,
      bend: false,
      bendPoints: [],
      slide: null,
      harmonic: null,
      harmonicShift: 0,
      wah: null,
      tremoloPicking: null,
      attackSec: 0.002,
      releaseSec: 0.02,
      filter: "palmMute"
    },
    mix: {
      muted: false,
      gain: 0.9,
      pan: 0,
      eq: "bright",
      effectChain: []
    }
  };
}

function countInDurationSeconds(compilation: PlaybackCompilation): number {
  const bpm = compilation.tempoMap.points[0]?.bpm ?? 120;
  return (60 / bpm) * 4;
}

function loopStartSecond(
  compilation: PlaybackCompilation,
  selection: SelectionRange | null,
  fallbackBarIndex: number
): number {
  const barIndex = selection
    ? Math.min(selection.anchor.barIndex, selection.head.barIndex)
    : fallbackBarIndex;
  return compilation.secondAtBar(barIndex);
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

function ensureBeatAtCursor(score: Score, cursor: CursorPosition) {
  const track = score.tracks.find((candidate) => candidate.id === cursor.trackId);
  const voice = track?.bars[cursor.barIndex]?.voices[cursor.voiceIndex];

  if (!voice) {
    return null;
  }

  while (voice.beats.length <= cursor.beatIndex) {
    voice.beats.push(createBeat({ duration: 4 }));
  }

  return voice.beats[cursor.beatIndex];
}

function selectedBarRange(
  score: Score,
  cursor: CursorPosition,
  selection: SelectionRange | null
): { start: number; end: number } {
  if (!selection) {
    return { start: cursor.barIndex, end: cursor.barIndex };
  }

  return {
    start: Math.max(0, Math.min(selection.anchor.barIndex, selection.head.barIndex)),
    end: Math.min(score.masterBars.length - 1, Math.max(selection.anchor.barIndex, selection.head.barIndex))
  };
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

export default App;
