import type { CursorMove } from "../engine/editing/types";
import type { Note } from "../model/types";
import { getCommand, registerCommand } from "./registry";

export interface EditorCommandContext {
  staffKind: "tab" | "standard";
  moveCursor: (move: CursorMove, extendSelection?: boolean) => void;
  moveBarSelection: (direction: -1 | 1) => void;
  toggleStaffKind: () => void;
  inputFret: (fret: number) => void;
  inputStandardString: (stringNumber: number) => void;
  changeDuration: (direction: "longer" | "shorter") => void;
  toggleRest: () => void;
  toggleTie: (wholeBeat?: boolean) => void;
  setDots: (dots: 1 | 2) => void;
  toggleTriplet: () => void;
  deleteNote: () => void;
  deleteBeat: () => void;
  deleteBar: () => void;
  insertBeat: () => void;
  insertBar: () => void;
  copyPreviousBeat: () => void;
  moveNoteString: (direction: -1 | 1) => void;
  transposeNote: (semitones: -1 | 1) => void;
  setAccidental: (accidental: Note["accidental"]) => void;
  selectAllTrack: () => void;
  copy: (mode: "single" | "multitrack", cut: boolean) => void;
  paste: (special: boolean) => void;
  undo: () => void;
  redo: () => void;
}

export function ensureEditingCommandsRegistered(): void {
  if (getCommand("cursor.moveLeft")) {
    return;
  }

  registerMove("cursor.moveLeft", "Move left", "ArrowLeft", "left");
  registerMove("cursor.moveRight", "Move right", "ArrowRight", "right");
  registerMove("cursor.moveUp", "Move up", "ArrowUp", "up");
  registerMove("cursor.moveDown", "Move down", "ArrowDown", "down");
  registerMove("cursor.home", "Bar start", "Home", "home");
  registerMove("cursor.end", "Bar end", "End", "end");
  registerMove("cursor.firstBar", "First bar", "Ctrl+Home", "firstBar");
  registerMove("cursor.lastBar", "Last bar", "Ctrl+End", "lastBar");
  registerMove("cursor.previousTrack", "Previous track", "Ctrl+ArrowUp", "previousTrack");
  registerMove("cursor.nextTrack", "Next track", "Ctrl+ArrowDown", "nextTrack");

  registerCommand<EditorCommandContext>({
    id: "cursor.toggleStaff",
    label: "Switch staff",
    category: "Cursor",
    shortcut: { win: "Tab", mac: "Tab" },
    execute: (context) => context.toggleStaffKind()
  });

  registerCommand<EditorCommandContext>({
    id: "duration.longer",
    label: "Longer duration",
    category: "Note",
    shortcut: { win: "-", mac: "-" },
    execute: (context) => context.changeDuration("longer")
  });

  registerCommand<EditorCommandContext>({
    id: "duration.shorter",
    label: "Shorter duration",
    category: "Note",
    shortcut: { win: "+", mac: "+" },
    execute: (context) => context.changeDuration("shorter")
  });

  registerCommand<EditorCommandContext>({
    id: "note.rest",
    label: "Rest",
    category: "Note",
    shortcut: { win: "R", mac: "R" },
    execute: (context) => context.toggleRest()
  });

  registerCommand<EditorCommandContext>({
    id: "note.tie",
    label: "Tie",
    category: "Note",
    shortcut: { win: "L", mac: "L" },
    execute: (context) => context.toggleTie(false)
  });

  registerCommand<EditorCommandContext>({
    id: "note.tieBeat",
    label: "Tie beat",
    category: "Note",
    shortcut: { win: "Shift+L", mac: "Shift+L" },
    execute: (context) => context.toggleTie(true)
  });

  registerCommand<EditorCommandContext>({
    id: "note.dot",
    label: "Dotted",
    category: "Note",
    shortcut: { win: "Shift+.", mac: "Shift+." },
    execute: (context) => context.setDots(1)
  });

  registerCommand<EditorCommandContext>({
    id: "note.doubleDot",
    label: "Double dotted",
    category: "Note",
    shortcut: { win: "Ctrl+.", mac: "Cmd+." },
    execute: (context) => context.setDots(2)
  });

  registerCommand<EditorCommandContext>({
    id: "note.triplet",
    label: "Triplet",
    category: "Note",
    shortcut: { win: "Shift+/", mac: "Shift+/" },
    execute: (context) => context.toggleTriplet()
  });

  registerCommand<EditorCommandContext>({
    id: "note.delete",
    label: "Delete note",
    category: "Edit",
    shortcut: { win: "Backspace", mac: "Backspace" },
    execute: (context) => context.deleteNote()
  });

  registerCommand<EditorCommandContext>({
    id: "beat.delete",
    label: "Delete beat",
    category: "Edit",
    shortcut: { win: "Shift+Delete", mac: "Shift+Backspace" },
    execute: (context) => context.deleteBeat()
  });

  registerCommand<EditorCommandContext>({
    id: "bar.delete",
    label: "Delete bar",
    category: "Edit",
    shortcut: { win: "Ctrl+Delete", mac: "Cmd+Backspace" },
    execute: (context) => context.deleteBar()
  });

  registerCommand<EditorCommandContext>({
    id: "bar.insert",
    label: "Insert bar",
    category: "Edit",
    shortcut: { win: "Insert", mac: "Insert" },
    execute: (context) => context.insertBar()
  });

  registerCommand<EditorCommandContext>({
    id: "beat.insert",
    label: "Insert beat",
    category: "Edit",
    shortcut: { win: "Ctrl+Insert", mac: "Cmd+Insert" },
    execute: (context) => context.insertBeat()
  });

  registerCommand<EditorCommandContext>({
    id: "beat.copyPrevious",
    label: "Copy previous beat",
    category: "Edit",
    shortcut: { win: "C", mac: "C" },
    execute: (context) => context.copyPreviousBeat()
  });

  registerCommand<EditorCommandContext>({
    id: "note.moveStringUp",
    label: "Move note to upper string",
    category: "Note",
    shortcut: { win: "Alt+ArrowUp", mac: "Alt+ArrowUp" },
    execute: (context) => context.moveNoteString(-1)
  });

  registerCommand<EditorCommandContext>({
    id: "note.moveStringDown",
    label: "Move note to lower string",
    category: "Note",
    shortcut: { win: "Alt+ArrowDown", mac: "Alt+ArrowDown" },
    execute: (context) => context.moveNoteString(1)
  });

  registerCommand<EditorCommandContext>({
    id: "note.transposeUp",
    label: "Transpose note up",
    category: "Note",
    shortcut: { win: "Alt+Shift+ArrowUp", mac: "Alt+Shift+ArrowUp" },
    execute: (context) => context.transposeNote(1)
  });

  registerCommand<EditorCommandContext>({
    id: "note.transposeDown",
    label: "Transpose note down",
    category: "Note",
    shortcut: { win: "Alt+Shift+ArrowDown", mac: "Alt+Shift+ArrowDown" },
    execute: (context) => context.transposeNote(-1)
  });

  registerCommand<EditorCommandContext>({
    id: "selection.extendBarRight",
    label: "Extend selection right",
    category: "Selection",
    shortcut: { win: "Ctrl+Shift+ArrowRight", mac: "Cmd+Shift+ArrowRight" },
    execute: (context) => context.moveBarSelection(1)
  });

  registerCommand<EditorCommandContext>({
    id: "selection.extendBarLeft",
    label: "Extend selection left",
    category: "Selection",
    shortcut: { win: "Ctrl+Shift+ArrowLeft", mac: "Cmd+Shift+ArrowLeft" },
    execute: (context) => context.moveBarSelection(-1)
  });

  registerCommand<EditorCommandContext>({
    id: "selection.selectTrack",
    label: "Select track",
    category: "Selection",
    shortcut: { win: "Ctrl+A", mac: "Cmd+A" },
    execute: (context) => context.selectAllTrack()
  });

  registerCommand<EditorCommandContext>({
    id: "clipboard.copy",
    label: "Copy",
    category: "Clipboard",
    shortcut: { win: "Ctrl+C", mac: "Cmd+C" },
    execute: (context) => context.copy("single", false)
  });

  registerCommand<EditorCommandContext>({
    id: "clipboard.cut",
    label: "Cut",
    category: "Clipboard",
    shortcut: { win: "Ctrl+X", mac: "Cmd+X" },
    execute: (context) => context.copy("single", true)
  });

  registerCommand<EditorCommandContext>({
    id: "clipboard.paste",
    label: "Paste",
    category: "Clipboard",
    shortcut: { win: "Ctrl+V", mac: "Cmd+V" },
    execute: (context) => context.paste(false)
  });

  registerCommand<EditorCommandContext>({
    id: "clipboard.copyMultitrack",
    label: "Copy all tracks",
    category: "Clipboard",
    shortcut: { win: "Ctrl+Shift+C", mac: "Cmd+Shift+C" },
    execute: (context) => context.copy("multitrack", false)
  });

  registerCommand<EditorCommandContext>({
    id: "clipboard.cutMultitrack",
    label: "Cut all tracks",
    category: "Clipboard",
    shortcut: { win: "Ctrl+Shift+X", mac: "Cmd+Shift+X" },
    execute: (context) => context.copy("multitrack", true)
  });

  registerCommand<EditorCommandContext>({
    id: "clipboard.specialPaste",
    label: "Special paste",
    category: "Clipboard",
    shortcut: { win: "Ctrl+Shift+V", mac: "Cmd+Shift+V" },
    execute: (context) => context.paste(true)
  });

  registerCommand<EditorCommandContext>({
    id: "history.undo",
    label: "Undo",
    category: "Edit",
    shortcut: { win: "Ctrl+Z", mac: "Cmd+Z" },
    execute: (context) => context.undo()
  });

  registerCommand<EditorCommandContext>({
    id: "history.redo",
    label: "Redo",
    category: "Edit",
    shortcut: { win: "Ctrl+Y", mac: "Shift+Cmd+Z" },
    execute: (context) => context.redo()
  });

  registerAccidentalCommands();
}

function registerMove(id: string, label: string, win: string, move: CursorMove): void {
  registerCommand<EditorCommandContext>({
    id,
    label,
    category: "Cursor",
    shortcut: { win, mac: win.replace("Ctrl", "Cmd") },
    execute: (context, args) => {
      const event = (args as { event?: KeyboardEvent } | undefined)?.event;
      context.moveCursor(move, event?.shiftKey ?? false);
    }
  });
}

function registerAccidentalCommands(): void {
  const accidentals: Array<[string, string, string, Note["accidental"]]> = [
    ["note.sharp", "Sharp", "Ctrl+9", "sharp"],
    ["note.flat", "Flat", "Ctrl+7", "flat"],
    ["note.natural", "Natural", "Ctrl+8", "natural"],
    ["note.doubleSharp", "Double sharp", "Ctrl+Alt+9", "doubleSharp"],
    ["note.doubleFlat", "Double flat", "Ctrl+Alt+7", "doubleFlat"],
    ["note.enharmonic", "Enharmonic", "Ctrl+Alt+8", "none"]
  ];

  accidentals.forEach(([id, label, win, accidental]) => {
    registerCommand<EditorCommandContext>({
      id,
      label,
      category: "Accidentals",
      shortcut: { win, mac: win.replace("Ctrl", "Cmd") },
      execute: (context) => context.setAccidental(accidental)
    });
  });
}
