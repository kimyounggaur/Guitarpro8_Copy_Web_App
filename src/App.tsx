import { useEffect, useMemo, useRef } from "react";
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
import type { ClipboardPayload, CursorMove, CursorPosition } from "./engine/editing/types";
import { layoutScore } from "./engine/layout/layoutScore";
import { createBar } from "./model/factory";
import type { SongInfo, Track } from "./model/types";
import { SvgRenderer } from "./engine/render/SvgRenderer";
import { createDemoScore } from "./model/demoScore";
import { useDocumentStore } from "./store/documentStore";
import { usePlaybackStore } from "./store/playbackStore";
import { usePreferencesStore } from "./store/preferencesStore";
import { useViewStore } from "./store/viewStore";
import { EditorShell } from "./ui/shell/EditorShell";

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
  const invertPlusMinus = usePreferencesStore((state) => state.invertPlusMinus);
  const panelVisibility = usePreferencesStore((state) => state.panelVisibility);
  const togglePanel = usePreferencesStore((state) => state.togglePanel);
  const demoScore = useMemo(() => createDemoScore(), []);
  const fretBufferRef = useRef<FretInputBuffer>({ digits: "", timer: null });
  const clipboardRef = useRef<ClipboardPayload | null>(null);

  useEffect(() => {
    if (score.tracks.length === 0) {
      loadScore(demoScore);
      setCursor(defaultCursor(demoScore));
    }
  }, [demoScore, loadScore, score.tracks.length, setCursor]);

  const baseScene = useMemo(
    () =>
      layoutScore(score, {
        editingBar: { barIndex: cursor.barIndex, trackId: cursor.trackId ?? undefined }
      }),
    [score, cursor]
  );
  const scene = useMemo(
    () => withEditorOverlays(baseScene, cursor, selection),
    [baseScene, cursor, selection]
  );

  useEffect(() => {
    function handlePanelShortcuts(event: KeyboardEvent) {
      const panelByKey = {
        F2: "palette",
        F5: "songInspector",
        F6: "trackInspector",
        F8: "globalView"
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

  const editorContext = useMemo<EditorCommandContext>(
    () => ({
      staffKind: cursor.staffKind,
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
      redoDocument,
      score,
      selection,
      setCursor,
      setSelection,
      transact,
      undoDocument
    ]
  );

  function dispatchEditorCommand(commandId: string): void {
    executeCommand(commandId, editorContext);
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
      dispatchCommand={dispatchEditorCommand}
      togglePanel={togglePanel}
      onSongInfoChange={handleSongInfoChange}
      onTrackChange={handleTrackChange}
      onGlobalJump={handleGlobalJump}
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

export default App;
