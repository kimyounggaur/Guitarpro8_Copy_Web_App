import type { TransportStatus } from "../engine/audio/transport";
import type { CursorMove } from "../engine/editing/types";
import type {
  BarSymbolCommand,
  BeatEffectCommand,
  NoteEffectCommand
} from "../engine/editing/operations";
import type { BeatDuration, Note } from "../model/types";
import { getCommand, registerCommand, type Command } from "./registry";
import type { EditorCommandId } from "./commandIds";

export interface EditorCommandContext {
  staffKind: "tab" | "standard";
  playbackStatus: TransportStatus;
  moveCursor: (move: CursorMove, extendSelection?: boolean) => void;
  moveBarSelection: (direction: -1 | 1) => void;
  toggleStaffKind: () => void;
  inputFretDigit: (digit: number) => void;
  endFretInput: () => void;
  inputStandardString: (stringNumber: number) => void;
  changeDuration: (direction: "longer" | "shorter") => void;
  setDuration: (duration: BeatDuration) => void;
  toggleRest: () => void;
  toggleTie: (wholeBeat?: boolean) => void;
  setDots: (dots: 1 | 2) => void;
  toggleTriplet: () => void;
  cycleTimeSignature: () => void;
  cycleKeySignature: () => void;
  toggleBarSymbol: (symbol: BarSymbolCommand) => void;
  setDynamic: (dynamic: Note["dynamic"]) => void;
  toggleNoteEffect: (effect: NoteEffectCommand) => void;
  toggleBeatEffect: (effect: BeatEffectCommand) => void;
  togglePlayback: (fromStart?: boolean) => void;
  stopPlayback: () => void;
  movePlaybackBar: (direction: -1 | 1) => void;
  stepPlaybackBeat: (direction: -1 | 1) => void;
  toggleLoop: () => void;
  toggleMetronome: () => void;
  toggleCountIn: () => void;
  changePlaybackSpeed: (direction: -1 | 1) => void;
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

function registerEditorCommand(command: Command<EditorCommandContext> & { id: EditorCommandId }): void {
  registerCommand(command);
}

export function ensureEditingCommandsRegistered(): void {
  if (getCommand("cursor.moveLeft")) {
    return;
  }

  registerMove("cursor.moveLeft", "Move left", "left");
  registerMove("cursor.moveRight", "Move right", "right");
  registerMove("cursor.moveUp", "Move up", "up");
  registerMove("cursor.moveDown", "Move down", "down");
  registerMove("cursor.home", "Bar start", "home");
  registerMove("cursor.end", "Bar end", "end");
  registerMove("cursor.firstBar", "First bar", "firstBar");
  registerMove("cursor.lastBar", "Last bar", "lastBar");
  registerMove("cursor.previousTrack", "Previous track", "previousTrack");
  registerMove("cursor.nextTrack", "Next track", "nextTrack");

  registerEditorCommand({
    id: "cursor.toggleStaff",
    label: "Switch staff",
    category: "Cursor",
    execute: (context) => context.toggleStaffKind()
  });

  registerEditorCommand({
    id: "duration.longer",
    label: "Longer duration",
    category: "Note",
    execute: (context) => context.changeDuration("longer")
  });

  registerEditorCommand({
    id: "duration.shorter",
    label: "Shorter duration",
    category: "Note",
    execute: (context) => context.changeDuration("shorter")
  });

  ([1, 2, 4, 8, 16, 32, 64] as BeatDuration[]).forEach((duration) => {
    registerEditorCommand({
      id: `duration.set.${duration}`,
      label: `${duration} note`,
      category: "Note",
      execute: (context) => context.setDuration(duration)
    });
  });

  registerEditorCommand({
    id: "note.rest",
    label: "Rest",
    category: "Note",
    execute: (context) => context.toggleRest()
  });

  registerEditorCommand({
    id: "note.tie",
    label: "Tie",
    category: "Note",
    execute: (context) => context.toggleTie(false)
  });

  registerEditorCommand({
    id: "note.tieBeat",
    label: "Tie beat",
    category: "Note",
    execute: (context) => context.toggleTie(true)
  });

  registerEditorCommand({
    id: "note.dot",
    label: "Dotted",
    category: "Note",
    execute: (context) => context.setDots(1)
  });

  registerEditorCommand({
    id: "note.doubleDot",
    label: "Double dotted",
    category: "Note",
    execute: (context) => context.setDots(2)
  });

  registerEditorCommand({
    id: "note.triplet",
    label: "Triplet",
    category: "Note",
    execute: (context) => context.toggleTriplet()
  });

  registerEditorCommand({
    id: "note.delete",
    label: "Delete note",
    category: "Edit",
    execute: (context) => context.deleteNote()
  });

  registerEditorCommand({
    id: "beat.delete",
    label: "Delete beat",
    category: "Edit",
    execute: (context) => context.deleteBeat()
  });

  registerEditorCommand({
    id: "bar.delete",
    label: "Delete bar",
    category: "Edit",
    execute: (context) => context.deleteBar()
  });

  registerEditorCommand({
    id: "bar.insert",
    label: "Insert bar",
    category: "Edit",
    execute: (context) => context.insertBar()
  });

  registerEditorCommand({
    id: "beat.insert",
    label: "Insert beat",
    category: "Edit",
    execute: (context) => context.insertBeat()
  });

  registerEditorCommand({
    id: "beat.copyPrevious",
    label: "Copy previous beat",
    category: "Edit",
    execute: (context) => context.copyPreviousBeat()
  });

  registerEditorCommand({
    id: "note.moveStringUp",
    label: "Move note to upper string",
    category: "Note",
    execute: (context) => context.moveNoteString(-1)
  });

  registerEditorCommand({
    id: "note.moveStringDown",
    label: "Move note to lower string",
    category: "Note",
    execute: (context) => context.moveNoteString(1)
  });

  registerEditorCommand({
    id: "note.transposeUp",
    label: "Transpose note up",
    category: "Note",
    execute: (context) => context.transposeNote(1)
  });

  registerEditorCommand({
    id: "note.transposeDown",
    label: "Transpose note down",
    category: "Note",
    execute: (context) => context.transposeNote(-1)
  });

  registerEditorCommand({
    id: "selection.extendBarRight",
    label: "Extend selection right",
    category: "Selection",
    execute: (context) => context.moveBarSelection(1)
  });

  registerEditorCommand({
    id: "selection.extendBarLeft",
    label: "Extend selection left",
    category: "Selection",
    execute: (context) => context.moveBarSelection(-1)
  });

  registerEditorCommand({
    id: "selection.selectTrack",
    label: "Select track",
    category: "Selection",
    execute: (context) => context.selectAllTrack()
  });

  registerEditorCommand({
    id: "clipboard.copy",
    label: "Copy",
    category: "Clipboard",
    execute: (context) => context.copy("single", false)
  });

  registerEditorCommand({
    id: "clipboard.cut",
    label: "Cut",
    category: "Clipboard",
    execute: (context) => context.copy("single", true)
  });

  registerEditorCommand({
    id: "clipboard.paste",
    label: "Paste",
    category: "Clipboard",
    execute: (context) => context.paste(false)
  });

  registerEditorCommand({
    id: "clipboard.copyMultitrack",
    label: "Copy all tracks",
    category: "Clipboard",
    execute: (context) => context.copy("multitrack", false)
  });

  registerEditorCommand({
    id: "clipboard.cutMultitrack",
    label: "Cut all tracks",
    category: "Clipboard",
    execute: (context) => context.copy("multitrack", true)
  });

  registerEditorCommand({
    id: "clipboard.specialPaste",
    label: "Special paste",
    category: "Clipboard",
    execute: (context) => context.paste(true)
  });

  registerEditorCommand({
    id: "history.undo",
    label: "Undo",
    category: "Edit",
    execute: (context) => context.undo()
  });

  registerEditorCommand({
    id: "history.redo",
    label: "Redo",
    category: "Edit",
    execute: (context) => context.redo()
  });

  registerAccidentalCommands();
  registerDynamicCommands();
  registerBarSymbolCommands();
  registerEffectCommands();
  registerPlaybackCommands();
}

function registerMove(id: EditorCommandId, label: string, move: CursorMove): void {
  registerEditorCommand({
    id,
    label,
    category: "Cursor",
    execute: (context, args) => {
      const event = (args as { event?: KeyboardEvent } | undefined)?.event;
      context.moveCursor(move, event?.shiftKey ?? false);
    }
  });
}

function registerAccidentalCommands(): void {
  const accidentals: Array<[EditorCommandId, string, Note["accidental"]]> = [
    ["note.sharp", "Sharp", "sharp"],
    ["note.flat", "Flat", "flat"],
    ["note.natural", "Natural", "natural"],
    ["note.doubleSharp", "Double sharp", "doubleSharp"],
    ["note.doubleFlat", "Double flat", "doubleFlat"],
    ["note.enharmonic", "Enharmonic", "none"]
  ];

  accidentals.forEach(([id, label, accidental]) => {
    registerEditorCommand({
      id,
      label,
      category: "Accidentals",
      execute: (context) => context.setAccidental(accidental)
    });
  });
}

function registerDynamicCommands(): void {
  const dynamics: Array<[EditorCommandId, string, Note["dynamic"]]> = [
    ["note.dynamic.0", "ppp", 0],
    ["note.dynamic.1", "pp", 1],
    ["note.dynamic.2", "p", 2],
    ["note.dynamic.3", "mp", 3],
    ["note.dynamic.4", "mf", 4],
    ["note.dynamic.5", "f", 5],
    ["note.dynamic.6", "ff", 6],
    ["note.dynamic.7", "fff", 7]
  ];

  dynamics.forEach(([id, label, dynamic]) => {
    registerEditorCommand({
      id,
      label,
      category: "Dynamics",
      execute: (context) => context.setDynamic(dynamic)
    });
  });
}

function registerBarSymbolCommands(): void {
  const symbols: Array<[EditorCommandId, string, BarSymbolCommand]> = [
    ["bar.symbol.repeatOpen", "Repeat open", "repeatOpen"],
    ["bar.symbol.repeatClose", "Repeat close", "repeatClose"],
    ["bar.symbol.doubleBar", "Double barline", "doubleBar"],
    ["bar.symbol.freeTime", "Free time", "freeTime"],
    ["bar.symbol.tripletFeel", "Triplet feel", "tripletFeel"],
    ["bar.symbol.alternateEnding", "Alternate ending", "alternateEnding"],
    ["bar.symbol.section", "Section", "section"],
    ["bar.symbol.directionTarget", "Direction target", "directionTarget"],
    ["bar.symbol.directionJump", "Direction jump", "directionJump"],
    ["bar.symbol.fermata", "Fermata", "fermata"],
    ["bar.symbol.simile", "Simile mark", "simile"],
    ["bar.symbol.anacrusis", "Anacrusis", "anacrusis"]
  ];

  registerEditorCommand({
    id: "bar.symbol.timeSignature",
    label: "Time signature",
    category: "Bar symbols",
    execute: (context) => context.cycleTimeSignature()
  });

  registerEditorCommand({
    id: "bar.symbol.keySignature",
    label: "Key signature",
    category: "Bar symbols",
    execute: (context) => context.cycleKeySignature()
  });

  symbols.forEach(([id, label, symbol]) => {
    registerEditorCommand({
      id,
      label,
      category: "Bar symbols",
      execute: (context) => context.toggleBarSymbol(symbol)
    });
  });
}

function registerEffectCommands(): void {
  const noteEffects: Array<[EditorCommandId, string, NoteEffectCommand]> = [
    ["note.effect.ghost", "Ghost note", "ghost"],
    ["note.effect.dead", "Dead note", "dead"],
    ["note.effect.accent", "Accent", "accent"],
    ["note.effect.heavyAccent", "Heavy accent", "heavyAccent"],
    ["note.effect.staccato", "Staccato", "staccato"],
    ["note.effect.letRing", "Let ring", "letRing"],
    ["note.effect.palmMute", "Palm mute", "palmMute"],
    ["note.effect.hopo", "Hammer-on/pull-off", "hopo"],
    ["note.effect.slide", "Slide", "slide"],
    ["note.effect.bend", "Bend", "bend"],
    ["note.effect.harmonic", "Harmonic", "harmonic"],
    ["note.effect.vibrato", "Vibrato", "vibrato"],
    ["note.effect.trill", "Trill", "trill"],
    ["note.effect.tremoloPicking", "Tremolo picking", "tremoloPicking"],
    ["note.effect.fadeIn", "Fade in", "fadeIn"],
    ["note.effect.fadeOut", "Fade out", "fadeOut"],
    ["note.effect.volumeSwell", "Volume swell", "volumeSwell"],
    ["note.effect.wah", "Wah", "wah"],
    ["note.effect.slap", "Slap", "slap"],
    ["note.effect.pop", "Pop", "pop"],
    ["note.effect.pickscrape", "Pickscrape", "pickscrape"],
    ["note.effect.deadSlapped", "Dead slapped", "deadSlapped"],
    ["note.effect.stringNumber", "String number", "stringNumber"]
  ];
  const beatEffects: Array<[EditorCommandId, string, BeatEffectCommand]> = [
    ["beat.effect.brushDown", "Brush down", "brushDown"],
    ["beat.effect.brushUp", "Brush up", "brushUp"],
    ["beat.effect.arpeggioDown", "Arpeggio down", "arpeggioDown"],
    ["beat.effect.arpeggioUp", "Arpeggio up", "arpeggioUp"],
    ["beat.effect.pickDown", "Pickstroke down", "pickDown"],
    ["beat.effect.pickUp", "Pickstroke up", "pickUp"],
    ["beat.effect.tapping", "Tapping", "tapping"],
    ["beat.effect.barVibrato", "Bar vibrato", "barVibrato"],
    ["beat.effect.hairpinCresc", "Crescendo", "hairpinCresc"],
    ["beat.effect.hairpinDecresc", "Decrescendo", "hairpinDecresc"],
    ["beat.effect.ottava", "Ottava", "ottava"]
  ];

  noteEffects.forEach(([id, label, effect]) => {
    registerEditorCommand({
      id,
      label,
      category: "Effects",
      execute: (context) => context.toggleNoteEffect(effect)
    });
  });

  beatEffects.forEach(([id, label, effect]) => {
    registerEditorCommand({
      id,
      label,
      category: "Effects",
      execute: (context) => context.toggleBeatEffect(effect)
    });
  });
}

function registerPlaybackCommands(): void {
  const commands: Array<[EditorCommandId, string, (context: EditorCommandContext) => void]> = [
    ["playback.toggle", "Play or stop", (context) => context.togglePlayback(false)],
    ["playback.fromStart", "Play from beginning", (context) => context.togglePlayback(true)],
    ["playback.stop", "Stop", (context) => context.stopPlayback()],
    ["playback.previousBar", "Previous bar", (context) => context.movePlaybackBar(-1)],
    ["playback.nextBar", "Next bar", (context) => context.movePlaybackBar(1)],
    ["playback.previousBeat", "Previous beat", (context) => context.stepPlaybackBeat(-1)],
    ["playback.nextBeat", "Next beat", (context) => context.stepPlaybackBeat(1)],
    ["playback.loop", "Loop", (context) => context.toggleLoop()],
    ["playback.metronome", "Metronome", (context) => context.toggleMetronome()],
    ["playback.countIn", "Count-in", (context) => context.toggleCountIn()],
    ["playback.speedUp", "Speed up", (context) => context.changePlaybackSpeed(1)],
    ["playback.speedDown", "Speed down", (context) => context.changePlaybackSpeed(-1)]
  ];

  commands.forEach(([id, label, execute]) => {
    registerEditorCommand({
      id,
      label,
      category: "Playback",
      execute
    });
  });
}
