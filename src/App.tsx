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
import { executeCommand, getAllCommands } from "./commands/registry";
import { cursorFromHit } from "./engine/editing/hitTest";
import {
  changeDurationAtCursor,
  cloneCurrentBar,
  copyPreviousBeat,
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
  setDotsAtCursor,
  shouldMutateOnMoveRight,
  tieCurrentNoteToNext,
  toggleRestAtCursor,
  toggleTripletAtCursor,
  transposeNoteAtCursor
} from "./engine/editing/operations";
import { withEditorOverlays } from "./engine/editing/overlays";
import type { ClipboardPayload, CursorMove, CursorPosition } from "./engine/editing/types";
import { layoutScore } from "./engine/layout/layoutScore";
import { createBar } from "./model/factory";
import { SvgRenderer } from "./engine/render/SvgRenderer";
import { createDemoScore } from "./model/demoScore";
import { useDocumentStore } from "./store/documentStore";
import { usePlaybackStore } from "./store/playbackStore";
import { usePreferencesStore } from "./store/preferencesStore";
import { useViewStore } from "./store/viewStore";

interface DemoCommandState {
  lastMessage: string;
}

function App() {
  ensureDemoCommandsRegistered();
  ensureEditingCommandsRegistered();

  const score = useDocumentStore((state) => state.score);
  const dirty = useDocumentStore((state) => state.dirty);
  const undoCount = useDocumentStore((state) => state.undoStack.length);
  const redoCount = useDocumentStore((state) => state.redoStack.length);
  const loadScore = useDocumentStore((state) => state.loadScore);
  const transact = useDocumentStore((state) => state.transact);
  const undoDocument = useDocumentStore((state) => state.undo);
  const redoDocument = useDocumentStore((state) => state.redo);
  const zoom = useViewStore((state) => state.zoom);
  const cursor = useViewStore((state) => state.cursor);
  const selection = useViewStore((state) => state.selection);
  const setCursor = useViewStore((state) => state.setCursor);
  const setSelection = useViewStore((state) => state.setSelection);
  const playbackStatus = usePlaybackStore((state) => state.status);
  const invertPlusMinus = usePreferencesStore((state) => state.invertPlusMinus);
  const [lastMessage, setLastMessage] = useState("No command executed yet.");
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
  const commands = useMemo(() => getAllCommands<DemoCommandState>(), []);

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
      toggleRest: () => editWithCursor("Set rest", (draft) => toggleRestAtCursor(draft, cursor)),
      toggleTie: (wholeBeat) =>
        editWithCursor("Tie note", (draft) => tieCurrentNoteToNext(draft, cursor, wholeBeat)),
      setDots: (dots) => editWithCursor("Set dots", (draft) => setDotsAtCursor(draft, cursor, dots)),
      toggleTriplet: () =>
        editWithCursor("Toggle triplet", (draft) => toggleTripletAtCursor(draft, cursor)),
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

  function runAboutCommand() {
    const commandState: DemoCommandState = { lastMessage };
    executeCommand("app.about", commandState);
    setLastMessage(commandState.lastMessage);
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

  return (
    <main className="appShell">
      <section className="workspace">
        <p className="eyebrow">Keyboard-first editing kernel</p>
        <h1>Guitar Pro Clone - Phase 3</h1>
        <div className="statusGrid" aria-label="Phase 3 state summary">
          <span>
            <strong>Tracks</strong>
            {score.tracks.length}
          </span>
          <span>
            <strong>Bars</strong>
            {score.masterBars.length}
          </span>
          <span>
            <strong>Dirty</strong>
            {dirty ? "yes" : "no"}
          </span>
          <span>
            <strong>History</strong>
            {undoCount}/{redoCount}
          </span>
        </div>
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
      </section>

      <aside className="debugPanel" aria-label="Registered commands">
        <div className="panelHeader">
          <h2>Registered Commands</h2>
          <button type="button" onClick={runAboutCommand}>
            Run app.about
          </button>
        </div>
        <p className="commandMessage">{lastMessage}</p>
        <div className="cursorReadout" aria-label="Cursor">
          <strong>Cursor</strong>
          <span>
            Bar {cursor.barIndex + 1}, Beat {cursor.beatIndex + 1}, Voice {cursor.voiceIndex + 1},{" "}
            {cursor.staffKind === "tab" ? `String ${cursor.string}` : `Line ${cursor.staffLine}`}
          </span>
          <em>{playbackStatus}</em>
        </div>
        <ul className="commandList">
          {commands.map((command) => (
            <li key={command.id}>
              <span>
                <strong>{command.label}</strong>
                <small>{command.id}</small>
              </span>
              <em>{command.category}</em>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}

export default App;
