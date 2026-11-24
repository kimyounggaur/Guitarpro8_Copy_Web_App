import { useLayoutEffect, useRef, useState, type MouseEventHandler, type RefObject } from "react";
import { beatDurationTicks, barTheoreticalTicks } from "../../model/derive";
import type { DisplayMode } from "../../model/types";
import { shortcutLabel } from "../../commands/keymap";
import type { EditorShellProps } from "./EditorShell";
import { ToolbarOverflowMenu, type ToolbarGroup } from "./ToolbarOverflowMenu";

type TopToolbarProps = Pick<EditorShellProps,
  | "score" | "cursor" | "platform" | "dispatchCommand" | "togglePanel"
  | "countInEnabled" | "metronomeEnabled" | "loopEnabled" | "speedPercent"
  | "playbackStatus" | "playbackBarIndex" | "playbackTimeSec" | "currentTempo" | "onTempoChange"
  | "multiVoiceEdit" | "multiTrackView" | "onToggleMultiTrackView"
  | "onFileIoPanelOpen" | "onTrackPanelOpen" | "onCommandPaletteOpen"
  | "onStylesheetPanelOpen" | "onToolOpen" | "onDisplayModeChange" | "onZoomChange"
> & { onMouseDown: MouseEventHandler<HTMLElement> };

const displayModes: Array<[DisplayMode, string, string]> = [
  ["vertical-page", "VP", "Vertical Page"],
  ["horizontal-page", "HP", "Horizontal Page"],
  ["grid", "Grid", "Grid"],
  ["parchment", "Parch", "Parchment"],
  ["vertical-screen", "VS", "Vertical Screen"],
  ["horizontal-screen", "HS", "Horizontal Screen"]
];

export function TopToolbar(props: TopToolbarProps) {
  const toolbarRef = useRef<HTMLElement>(null);
  const requiredRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const currentTrack = props.score.tracks.find((track) => track.id === props.cursor.trackId);
  const { zoom, displayMode } = props.score.documentSettings;
  const { cursor } = props;
  const [tempoDraft, setTempoDraft] = useState<string | null>(null);
  const tempoEditing = useRef(false);
  const tempoEdited = useRef(false);
  const tempoButton = useRef<HTMLButtonElement>(null);

  function finishTempo(value?: string) {
    if (!tempoEditing.current) return;
    tempoEditing.current = false;
    setTempoDraft(null);
    if (tempoEdited.current && value?.trim() && Number.isFinite(Number(value))) {
      props.onTempoChange(Number(value));
    }
    tempoEdited.current = false;
  }

  function title(label: string, command: string) {
    const shortcut = shortcutLabel(command, props.platform);
    return shortcut ? `${label} ${shortcut}` : label;
  }

  const groups: ToolbarGroup[] = [
    {
      id: "view",
      title: "View",
      className: "toolbarViewGroup",
      actions: [
        { id: "view.zoomOut", label: "−", title: title("Zoom out", "view.zoomOut"), run: () => props.onZoomChange(zoom - 10) },
        { id: "view.zoomIn", label: "+", title: title("Zoom in", "view.zoomIn"), run: () => props.onZoomChange(zoom + 10) },
        ...displayModes.map(([mode, label, name]) => ({
          id: mode,
          label,
          title: name,
          pressed: displayMode === mode,
          run: () => props.onDisplayModeChange(mode)
        })),
        { id: "playback.speedDown", label: "−", title: "Speed down", run: () => props.dispatchCommand("playback.speedDown") },
        { id: "playback.speedUp", label: "+", title: "Speed up", run: () => props.dispatchCommand("playback.speedUp") },
        { id: "file.print", label: "⎙", title: title("Print", "file.print"), disabled: true }
      ]
    },
    {
      id: "panels",
      title: "Panels",
      className: "panelGroup",
      actions: [
        { id: "panels.palette", label: "◧", title: title("Palette", "panels.palette"), run: () => props.togglePanel("palette") },
        { id: "panels.songInspector", label: "♫", title: title("Song Inspector", "panels.songInspector"), run: () => props.togglePanel("songInspector") },
        { id: "panels.trackInspector", label: "⚙", title: title("Track Inspector", "panels.trackInspector"), run: () => props.togglePanel("trackInspector") },
        { id: "panels.globalView", label: "▤", title: title("Global View", "panels.globalView"), run: () => props.togglePanel("globalView") },
        { id: "panels.automation", label: "A", title: title("Automation", "panels.automation"), run: () => props.togglePanel("automationView") }
      ]
    },
    {
      id: "tools",
      title: "Tools",
      className: "toolLaunchGroup",
      actions: [
        { id: "track.add", label: "+Trk", title: title("Add Track", "track.add"), run: () => props.onTrackPanelOpen("wizard") },
        { id: "track.tuning", label: "Tune", title: "Tuning", disabled: !currentTrack, run: () => props.onTrackPanelOpen("tuning") },
        { id: "track.voices", label: "Vox", title: title("Voices", "voice.toggleMulti"), pressed: props.multiVoiceEdit, run: () => props.onTrackPanelOpen("voices") },
        { id: "track.drums", label: "Kit", title: "Drum kit", disabled: currentTrack?.icon !== "drums", run: () => props.onTrackPanelOpen("drums") },
        { id: "tools.commandPalette", label: "Cmd", title: title("Command Palette", "tools.commandPalette"), testId: "command-palette-open", run: () => props.onCommandPaletteOpen() },
        { id: "view.stylesheet", label: "Style", title: title("Score Stylesheet", "view.stylesheet"), run: props.onStylesheetPanelOpen },
        { id: "tools.chords", label: "Chord", title: title("Chord tool", "tools.chords"), run: () => props.onToolOpen("chords") },
        { id: "tools.scales", label: "Scale", title: title("Scale tool", "tools.scales"), run: () => props.onToolOpen("scales") },
        { id: "tools.instrument", label: "Fret", title: title("Instrument view", "tools.instrument"), run: () => props.onToolOpen("instrument") },
        { id: "tools.tuner", label: "Tune", title: "Tuner", run: () => props.onToolOpen("tuner") },
        { id: "tools.transpose", label: "Trans", title: "Transpose", run: () => props.onToolOpen("transpose") },
        { id: "tools.cleanup", label: "Check", title: title("Check bar duration", "tools.cleanup"), run: () => props.onToolOpen("cleanup") }
      ]
    }
  ];
  const visibleCount = useToolbarOverflow(toolbarRef, requiredRef, measureRef);
  const voice = currentTrack?.bars[cursor.barIndex]?.voices[cursor.voiceIndex];
  const masterBar = props.score.masterBars[cursor.barIndex];
  const expected = masterBar ? barTheoreticalTicks(masterBar) : 0;
  const actual = voice?.beats.reduce((sum, beat) => sum + beatDurationTicks(beat), 0) ?? 0;
  const issue = actual !== expected;

  return (
    <div className="toolbarShell">
      <header ref={toolbarRef} className="toolbar" aria-label="Toolbar" onMouseDown={props.onMouseDown}>
        <div ref={requiredRef} className="toolbarRequired">
          <div className="toolbarGroup homeGroup">
            <button type="button" title="File I/O" onClick={props.onFileIoPanelOpen}>File</button>
          </div>
          <div className="toolbarGroup historyGroup">
            <button type="button" title={title("Undo", "history.undo")} onClick={() => props.dispatchCommand("history.undo")}>↶</button>
            <button type="button" title={title("Redo", "history.redo")} onClick={() => props.dispatchCommand("history.redo")}>↷</button>
          </div>
          <div className="toolbarGroup transportGroup">
            <button type="button" title="First bar" onClick={() => props.dispatchCommand("cursor.firstBar")}>|&lt;</button>
            <button type="button" title={title("Previous bar", "playback.previousBar")} onClick={() => props.dispatchCommand("playback.previousBar")}>&lt;</button>
            <button type="button" title="Play / stop Space" data-testid="transport-play-stop" onClick={() => props.dispatchCommand("playback.toggle")}>
              {(props.playbackStatus === "playing" || props.playbackStatus === "starting") ? "Stop" : "Play"}
            </button>
            <button type="button" title={title("Next bar", "playback.nextBar")} onClick={() => props.dispatchCommand("playback.nextBar")}>&gt;</button>
            <button type="button" title="Last bar" onClick={() => props.dispatchCommand("cursor.lastBar")}>&gt;|</button>
          </div>
          <div className="lcd" title={issue ? `Voice ${cursor.voiceIndex + 1}: ${actual}/${expected}` : "Bar duration ok"}>
            <span className="trackColor" style={{ background: currentTrack?.color ?? "#64748b" }} />
            <strong>{currentTrack?.shortName ?? "Track"}</strong>
            {tempoDraft === null ? (
              <button ref={tempoButton} type="button" className="lcdTempo" title="Edit measure tempo" data-testid="lcd-tempo" onClick={() => {
                tempoEditing.current = true;
                setTempoDraft(String(Math.round(props.currentTempo)));
              }}>
                ♩ {Math.round(props.currentTempo)}
              </button>
            ) : (
              <input
                className="lcdTempoInput"
                aria-label="Tempo BPM"
                type="number"
                min={10}
                max={300}
                autoFocus
                value={tempoDraft}
                onChange={(event) => {
                  tempoEdited.current = true;
                  setTempoDraft(event.target.value);
                }}
                onBlur={(event) => finishTempo(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === "Escape") {
                    event.preventDefault();
                    finishTempo(event.key === "Enter" ? event.currentTarget.value : undefined);
                    requestAnimationFrame(() => tempoButton.current?.focus());
                  }
                }}
              />
            )}
            <span className={issue ? "lcdWarning" : ""}>{Math.round(actual)}/{Math.round(expected)}</span>
            <button type="button" aria-pressed={props.multiTrackView} className={props.multiTrackView ? "activeToggle" : ""} title={title("Multitrack view", "view.multitrack")} onClick={props.onToggleMultiTrackView}>
              {props.multiTrackView ? "Multi" : "1"}
            </button>
            <button type="button" disabled>♫</button>
            <button type="button" disabled>⚙</button>
          </div>
          <div className="toolbarGroup playbackTools">
            <button type="button" aria-pressed={props.countInEnabled} className={props.countInEnabled ? "activeToggle" : ""} title="Count-in" onClick={() => props.dispatchCommand("playback.countIn")}>C</button>
            <button type="button" aria-pressed={props.metronomeEnabled} className={props.metronomeEnabled ? "activeToggle" : ""} title="Metronome" onClick={() => props.dispatchCommand("playback.metronome")}>M</button>
            <button type="button" aria-pressed={props.loopEnabled} className={props.loopEnabled ? "activeToggle" : ""} title={title("Loop", "playback.loop")} onClick={() => props.dispatchCommand("playback.loop")}>Loop</button>
            <span className="playbackReadout">
              {props.playbackStatus === "playing"
                ? `Bar ${props.playbackBarIndex + 1} / ${props.playbackTimeSec.toFixed(1)}s`
                : `Bar ${cursor.barIndex + 1} / Ready`}
            </span>
          </div>
        </div>
        {groups.slice(0, visibleCount).map((group) => (
          <ToolbarGroupContent key={group.id} group={group} zoom={zoom} speed={props.speedPercent} />
        ))}
        {visibleCount < groups.length ? <ToolbarOverflowMenu groups={groups.slice(visibleCount)} /> : null}
        <div className="toolbarMeasure" aria-hidden="true">
          <div className="toolbarMeasureRow" ref={measureRef}>
            {groups.map((group) => (
              <ToolbarGroupContent key={group.id} group={group} zoom={zoom} speed={props.speedPercent} measuring />
            ))}
            <span className="toolbarMore" />
          </div>
        </div>
      </header>
      <p className="toolbarNarrowNotice">편집 기능은 가로 1024px 이상 화면에서 지원합니다</p>
    </div>
  );
}

function ToolbarGroupContent({
  group,
  zoom,
  speed,
  measuring = false
}: {
  group: ToolbarGroup;
  zoom: number;
  speed: number;
  measuring?: boolean;
}) {
  return (
    <div className={`toolbarGroup ${group.className}`}>
      {group.actions.map((action) => (
        <button
          type="button"
          key={action.id}
          tabIndex={measuring ? -1 : undefined}
          disabled={measuring || action.disabled}
          title={measuring ? undefined : action.title}
          data-testid={measuring ? undefined : action.testId}
          aria-pressed={measuring ? undefined : action.pressed}
          className={action.pressed ? "activeToggle" : undefined}
          onClick={measuring ? undefined : action.run}
        >
          {action.label}
        </button>
      ))}
      {group.id === "view" ? <span className="toolbarViewValues">{zoom}% · {speed}%</span> : null}
    </div>
  );
}

function useToolbarOverflow(
  toolbarRef: RefObject<HTMLElement>,
  requiredRef: RefObject<HTMLDivElement>,
  measureRef: RefObject<HTMLDivElement>
) {
  const [visibleCount, setVisibleCount] = useState(0);

  useLayoutEffect(() => {
    const toolbar = toolbarRef.current;
    const required = requiredRef.current;
    const measure = measureRef.current;
    if (!toolbar || !required || !measure) return;

    const measureGroups = () => {
      const toolbarLayout = getComputedStyle(toolbar);
      const available = toolbar.clientWidth - parseFloat(toolbarLayout.paddingLeft) - parseFloat(toolbarLayout.paddingRight);
      const gap = parseFloat(toolbarLayout.columnGap);
      const requiredWidth = required.getBoundingClientRect().width;
      const widths = Array.from(measure.children, (element) => element.getBoundingClientRect().width);
      const moreWidth = widths.pop() ?? 0;
      const allWidth = requiredWidth + widths.reduce((total, width) => total + gap + width, 0);
      let remaining = available - requiredWidth - gap - moreWidth;
      let count = 0;
      if (allWidth <= available) {
        count = widths.length;
      } else {
        for (const width of widths) {
          remaining -= width + gap;
          if (remaining < 0) break;
          count++;
        }
      }
      setVisibleCount(count);
    };

    const observer = new ResizeObserver(measureGroups);
    observer.observe(toolbar);
    observer.observe(required);
    observer.observe(measure);
    measureGroups();
    return () => observer.disconnect();
  }, [toolbarRef, requiredRef, measureRef]);

  return visibleCount;
}
