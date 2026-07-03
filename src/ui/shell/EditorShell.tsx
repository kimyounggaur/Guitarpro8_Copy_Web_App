import type { ReactNode } from "react";
import { beatDurationTicks, barTheoreticalTicks } from "../../model/derive";
import type { BeatDuration, Score, SongInfo, Track } from "../../model/types";
import type { CursorPosition } from "../../engine/editing/types";
import type { DocumentTabState } from "../../store/documentStore";
import type { PanelVisibility } from "../../store/preferencesStore";

interface EditorShellProps {
  score: Score;
  cursor: CursorPosition;
  dirty: boolean;
  undoCount: number;
  redoCount: number;
  documents: DocumentTabState[];
  activeId: string;
  panelVisibility: PanelVisibility;
  playbackStatus: string;
  playbackBarIndex: number;
  playbackTick: number;
  playbackTimeSec: number;
  loopEnabled: boolean;
  metronomeEnabled: boolean;
  countInEnabled: boolean;
  speedPercent: number;
  workspace: ReactNode;
  dispatchCommand: (commandId: string) => void;
  togglePanel: (panel: keyof PanelVisibility) => void;
  onSongInfoChange: (field: keyof SongInfo, value: string) => void;
  onTrackChange: (trackId: string, patch: Partial<Pick<Track, "name" | "shortName" | "color">>) => void;
  onGlobalJump: (trackId: string, barIndex: number) => void;
}

const menuNames = [
  "File",
  "Edit",
  "Track",
  "Bar",
  "Note",
  "Effects",
  "Section",
  "Tools",
  "Sound",
  "View",
  "Window",
  "Help"
];

const noteDurations: BeatDuration[] = [1, 2, 4, 8, 16, 32, 64];
const barSymbolButtons = [
  ["Time", "bar.symbol.timeSignature"],
  ["Key", "bar.symbol.keySignature"],
  ["|:", "bar.symbol.repeatOpen"],
  [":|", "bar.symbol.repeatClose"],
  ["||", "bar.symbol.doubleBar"],
  ["Volta", "bar.symbol.alternateEnding"],
  ["Segno", "bar.symbol.directionTarget"],
  ["D.C.", "bar.symbol.directionJump"],
  ["Ferm.", "bar.symbol.fermata"],
  ["Simile", "bar.symbol.simile"],
  ["Swing", "bar.symbol.tripletFeel"],
  ["Free", "bar.symbol.freeTime"],
  ["Pickup", "bar.symbol.anacrusis"],
  ["Sec.", "bar.symbol.section"]
] as const;
const noteEffectButtons = [
  ["ghost", "note.effect.ghost"],
  ["x", "note.effect.dead"],
  [">", "note.effect.accent"],
  ["^", "note.effect.heavyAccent"],
  ["stac", "note.effect.staccato"],
  ["let", "note.effect.letRing"],
  ["PM", "note.effect.palmMute"],
  ["H/P", "note.effect.hopo"],
  ["slide", "note.effect.slide"],
  ["bend", "note.effect.bend"],
  ["N.H.", "note.effect.harmonic"],
  ["vib", "note.effect.vibrato"],
  ["tr", "note.effect.trill"],
  ["trem", "note.effect.tremoloPicking"],
  ["wah", "note.effect.wah"],
  ["slap", "note.effect.slap"],
  ["pop", "note.effect.pop"],
  ["str", "note.effect.stringNumber"]
] as const;
const beatEffectButtons = [
  ["brush v", "beat.effect.brushDown"],
  ["brush ^", "beat.effect.brushUp"],
  ["arp v", "beat.effect.arpeggioDown"],
  ["arp ^", "beat.effect.arpeggioUp"],
  ["pick v", "beat.effect.pickDown"],
  ["pick ^", "beat.effect.pickUp"],
  ["tap", "beat.effect.tapping"],
  ["bar vib", "beat.effect.barVibrato"],
  ["<", "beat.effect.hairpinCresc"],
  [">", "beat.effect.hairpinDecresc"],
  ["8va", "beat.effect.ottava"]
] as const;
const songFields: Array<keyof SongInfo> = [
  "title",
  "artist",
  "subtitle",
  "album",
  "words",
  "music",
  "copyright",
  "transcriber",
  "notice",
  "instructions"
];

export function EditorShell(props: EditorShellProps) {
  return (
    <main className="gpShell">
      <MenuBar />
      <Toolbar {...props} />
      <TabBar documents={props.documents} activeId={props.activeId} />
      <section
        className={[
          "gpMain",
          props.panelVisibility.palette ? "" : "paletteHidden",
          props.panelVisibility.songInspector || props.panelVisibility.trackInspector ? "" : "inspectorHidden"
        ].join(" ")}
      >
        {props.panelVisibility.palette ? <EditionPalette dispatchCommand={props.dispatchCommand} /> : null}
        <section className="workspacePanel">{props.workspace}</section>
        {props.panelVisibility.songInspector || props.panelVisibility.trackInspector ? (
          <InspectorPanel {...props} />
        ) : null}
      </section>
      {props.panelVisibility.globalView ? <GlobalView {...props} /> : null}
    </main>
  );
}

function MenuBar() {
  return (
    <nav className="menuBar" aria-label="Application menus">
      {menuNames.map((menu) => (
        <button key={menu} type="button">
          {menu}
        </button>
      ))}
    </nav>
  );
}

function Toolbar(props: EditorShellProps) {
  const currentTrack = props.score.tracks.find((track) => track.id === props.cursor.trackId);
  const lcd = currentLcdStatus(props.score, props.cursor);

  return (
    <header className="toolbar" aria-label="Toolbar">
      <div className="toolbarGroup homeGroup">
        <button type="button" title="Home" disabled>
          ⌂
        </button>
      </div>
      <div className="toolbarGroup panelGroup">
        <button type="button" title="Palette F2" onClick={() => props.togglePanel("palette")}>
          ◧
        </button>
        <button type="button" title="Song Inspector F5" onClick={() => props.togglePanel("songInspector")}>
          ♫
        </button>
        <button type="button" title="Track Inspector F6" onClick={() => props.togglePanel("trackInspector")}>
          ⚙
        </button>
        <button type="button" title="Global View F8" onClick={() => props.togglePanel("globalView")}>
          ▤
        </button>
      </div>
      <div className="toolbarGroup zoomGroup">
        <button type="button" disabled>
          −
        </button>
        <span>100%</span>
        <button type="button" disabled>
          +
        </button>
      </div>
      <div className="toolbarGroup displayGroup">
        {["P", "H", "G", "S"].map((mode) => (
          <button key={mode} type="button" disabled>
            {mode}
          </button>
        ))}
      </div>
      <div className="toolbarGroup historyGroup">
        <button type="button" title="Undo Ctrl+Z" onClick={() => props.dispatchCommand("history.undo")}>
          ↶
        </button>
        <button type="button" title="Redo Ctrl+Y" onClick={() => props.dispatchCommand("history.redo")}>
          ↷
        </button>
      </div>
      <div className="toolbarGroup printGroup">
        <button type="button" disabled title="Print Ctrl+P">
          ⎙
        </button>
      </div>
      <div className="toolbarGroup transportGroup">
        <button type="button" title="First bar" onClick={() => props.dispatchCommand("cursor.firstBar")}>
          |&lt;
        </button>
        <button type="button" title="Previous bar Ctrl+Left" onClick={() => props.dispatchCommand("playback.previousBar")}>
          &lt;
        </button>
        <button type="button" title="Play / stop Space" onClick={() => props.dispatchCommand("playback.toggle")}>
          {props.playbackStatus === "playing" ? "Stop" : "Play"}
        </button>
        <button type="button" title="Next bar Ctrl+Right" onClick={() => props.dispatchCommand("playback.nextBar")}>
          &gt;
        </button>
        <button type="button" title="Last bar" onClick={() => props.dispatchCommand("cursor.lastBar")}>
          &gt;|
        </button>
      </div>
      <div className="toolbarGroup transportGroup transportLegacy">
        {["⏮", "◀", props.playbackStatus === "playing" ? "■" : "▶", "▶", "⏭"].map((label, index) => (
          <button key={`${label}-${index}`} type="button" disabled>
            {label}
          </button>
        ))}
      </div>
      <div className="lcd" title={lcd.title}>
        <span className="trackColor" style={{ background: currentTrack?.color ?? "#64748b" }} />
        <strong>{currentTrack?.shortName ?? "Track"}</strong>
        <span>♩ 120</span>
        <span className={lcd.issue ? "lcdWarning" : ""}>
          {lcd.actual}/{lcd.expected}
        </span>
        <button type="button" disabled>
          1
        </button>
        <button type="button" disabled>
          ♫
        </button>
        <button type="button" disabled>
          ⚙
        </button>
      </div>
      <div className="toolbarGroup playbackTools">
        <button type="button" className={props.countInEnabled ? "activeToggle" : ""} title="Count-in" onClick={() => props.dispatchCommand("playback.countIn")}>
          C
        </button>
        <button type="button" className={props.metronomeEnabled ? "activeToggle" : ""} title="Metronome" onClick={() => props.dispatchCommand("playback.metronome")}>
          M
        </button>
        <button type="button" className={props.loopEnabled ? "activeToggle" : ""} title="Loop F9" onClick={() => props.dispatchCommand("playback.loop")}>
          Loop
        </button>
        <button type="button" title="Speed down" onClick={() => props.dispatchCommand("playback.speedDown")}>
          -
        </button>
        <button type="button" title="Playback speed">
          {props.speedPercent}%
        </button>
        <button type="button" title="Speed up" onClick={() => props.dispatchCommand("playback.speedUp")}>
          +
        </button>
        <span className="playbackReadout">
          {props.playbackStatus === "playing"
            ? `Bar ${props.playbackBarIndex + 1} / ${props.playbackTimeSec.toFixed(1)}s`
            : `Bar ${props.cursor.barIndex + 1} / Ready`}
        </span>
      </div>
      <div className="toolbarGroup utilityGroup utilityLegacy">
        {["Loop", "100%", "C", "Audio", "View", "Tune", "Line"].map((label) => (
          <button key={label} type="button" disabled>
            {label}
          </button>
        ))}
      </div>
    </header>
  );
}

function TabBar({
  documents,
  activeId
}: Pick<EditorShellProps, "documents" | "activeId">) {
  return (
    <div className="tabBar" aria-label="Open documents">
      {documents.map((document) => (
        <button key={document.id} type="button" className={document.id === activeId ? "activeTab" : ""}>
          {document.locked ? "L " : ""}
          {document.title}
          {document.dirty ? " ●" : ""}
        </button>
      ))}
      <button type="button" className="tabAdd">
        +
      </button>
    </div>
  );
}

function EditionPalette({ dispatchCommand }: Pick<EditorShellProps, "dispatchCommand">) {
  return (
    <aside className="palettePanel" aria-label="Edition palette">
      <PaletteGroup title="Voices">
        {[1, 2, 3, 4].map((voice) => (
          <button key={voice} type="button" disabled={voice !== 1}>
            V{voice}
          </button>
        ))}
      </PaletteGroup>
      {["Multivoice", "Design", "Lyrics", "Chords"].map((title) => (
        <PaletteGroup key={title} title={title} disabled />
      ))}
      <PaletteGroup title="Bar symbols">
        {barSymbolButtons.map(([label, command]) => (
          <button key={command} type="button" onClick={() => dispatchCommand(command)}>
            {label}
          </button>
        ))}
      </PaletteGroup>
      <PaletteGroup title="Note symbols">
        {noteDurations.map((duration) => (
          <button key={duration} type="button" onClick={() => dispatchCommand(`duration.set.${duration}`)}>
            {duration}
          </button>
        ))}
        <button type="button" onClick={() => dispatchCommand("note.dot")}>
          •
        </button>
        <button type="button" onClick={() => dispatchCommand("note.doubleDot")}>
          ••
        </button>
        <button type="button" className="modeButton" onClick={() => dispatchCommand("note.triplet")}>
          3
        </button>
        <button type="button" onClick={() => dispatchCommand("note.tie")}>
          ⌒
        </button>
        {[
          ["♯", "note.sharp"],
          ["♭", "note.flat"],
          ["♮", "note.natural"],
          ["𝄪", "note.doubleSharp"],
          ["𝄫", "note.doubleFlat"]
        ].map(([label, command]) => (
          <button key={command} type="button" onClick={() => dispatchCommand(command)}>
            {label}
          </button>
        ))}
        {["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"].map((dynamic, index) => (
          <button key={dynamic} type="button" onClick={() => dispatchCommand(`note.dynamic.${index}`)}>
            {dynamic}
          </button>
        ))}
      </PaletteGroup>
      <PaletteGroup title="Effect symbols">
        {noteEffectButtons.map(([label, command]) => (
          <button key={command} type="button" onClick={() => dispatchCommand(command)}>
            {label}
          </button>
        ))}
      </PaletteGroup>
      <PaletteGroup title="Beat effects">
        {beatEffectButtons.map(([label, command]) => (
          <button key={command} type="button" onClick={() => dispatchCommand(command)}>
            {label}
          </button>
        ))}
      </PaletteGroup>
      {["Notation symbols", "Automation symbols"].map((title) => (
        <PaletteGroup key={title} title={title} disabled />
      ))}
    </aside>
  );
}

function PaletteGroup({
  title,
  disabled,
  children
}: {
  title: string;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <section className="paletteGroup">
      <h2>{title}</h2>
      <div className="paletteButtons">
        {children ?? (
          <button type="button" disabled={disabled}>
            ▸
          </button>
        )}
      </div>
    </section>
  );
}

function InspectorPanel(props: EditorShellProps) {
  const currentTrack = props.score.tracks.find((track) => track.id === props.cursor.trackId);

  return (
    <aside className="inspectorPanel" aria-label="Inspector">
      {props.panelVisibility.songInspector ? (
        <section>
          <h2>Song</h2>
          {songFields.map((field) => (
            <label key={field}>
              <span>{field}</span>
              <input
                value={props.score.meta[field]}
                onChange={(event) => props.onSongInfoChange(field, event.target.value)}
              />
            </label>
          ))}
          <button type="button" disabled>
            Concert tone
          </button>
        </section>
      ) : null}
      {props.panelVisibility.trackInspector && currentTrack ? (
        <section>
          <h2>Track</h2>
          <label>
            <span>Name</span>
            <input
              value={currentTrack.name}
              onChange={(event) => props.onTrackChange(currentTrack.id, { name: event.target.value })}
            />
          </label>
          <label>
            <span>Short</span>
            <input
              value={currentTrack.shortName}
              onChange={(event) => props.onTrackChange(currentTrack.id, { shortName: event.target.value })}
            />
          </label>
          <label>
            <span>Color</span>
            <input
              type="color"
              value={currentTrack.color}
              onChange={(event) => props.onTrackChange(currentTrack.id, { color: event.target.value })}
            />
          </label>
          <div className="notationChecks">
            {["standard", "tab", "slash", "numbered"].map((notation) => (
              <label key={notation}>
                <input type="checkbox" checked={currentTrack.notationTypes.includes(notation as never)} readOnly />
                <span>{notation}</span>
              </label>
            ))}
          </div>
          <p>{currentTrack.tuning.label}</p>
          <button type="button" disabled>
            Interpretation
          </button>
        </section>
      ) : null}
    </aside>
  );
}

function GlobalView(props: EditorShellProps) {
  return (
    <section className="globalView" aria-label="Global view">
      <div className="globalTracks">
        <button type="button" disabled>
          + Track
        </button>
        {props.score.tracks.map((track) => (
          <button
            key={track.id}
            type="button"
            className={track.id === props.cursor.trackId ? "activeTrack" : ""}
            onClick={() => props.onGlobalJump(track.id, props.cursor.barIndex)}
          >
            <span style={{ background: track.color }} />
            {track.shortName}
          </button>
        ))}
      </div>
      <div className="globalGrid" style={{ gridTemplateColumns: `repeat(${props.score.masterBars.length}, 42px)` }}>
        {props.score.masterBars.map((_, barIndex) => (
          <span key={`header-${barIndex}`} className="globalHeader">
            {barIndex + 1}
          </span>
        ))}
        {props.score.tracks.flatMap((track) =>
          props.score.masterBars.map((_, barIndex) => (
            <button
              key={`${track.id}-${barIndex}`}
              type="button"
              className={
                track.id === props.cursor.trackId && barIndex === props.cursor.barIndex
                  ? "globalCell activeCell"
                  : "globalCell"
              }
              onClick={() => props.onGlobalJump(track.id, barIndex)}
            >
              <span style={{ background: track.color }} />
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function currentLcdStatus(score: Score, cursor: CursorPosition) {
  const track = score.tracks.find((candidate) => candidate.id === cursor.trackId);
  const voice = track?.bars[cursor.barIndex]?.voices[cursor.voiceIndex];
  const expected = score.masterBars[cursor.barIndex]
    ? barTheoreticalTicks(score.masterBars[cursor.barIndex])
    : 0;
  const actual = voice?.beats.reduce((total, beat) => total + beatDurationTicks(beat), 0) ?? 0;
  const issue = actual !== expected;

  return {
    actual: Math.round(actual),
    expected: Math.round(expected),
    issue,
    title: issue ? `Voice ${cursor.voiceIndex + 1}: ${actual}/${expected}` : "Bar duration ok"
  };
}
