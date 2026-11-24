import { t } from "../i18n/messages.en";
import { useViewStore } from "../../store/viewStore";
import { useLayoutEffect, useRef, useState, type MouseEventHandler, type RefObject } from "react";
import { beatDurationTicks, barTheoreticalTicks } from "../../model/derive";
import type { DisplayMode } from "../../model/types";
import { usePlaybackStore } from "../../store/playbackStore";
import { shortcutLabel } from "../../commands/keymap";
import type { EditorShellProps } from "./EditorShell";
import { ToolbarOverflowMenu, type ToolbarGroup } from "./ToolbarOverflowMenu";

type TopToolbarProps = Pick<EditorShellProps,
  | "score" | "cursor" | "platform" | "dispatchCommand" | "togglePanel"
  | "countInEnabled" | "metronomeEnabled" | "loopEnabled" | "speedPercent"
  | "playbackStatus" | "playbackBarIndex" | "currentTempo" | "onTempoChange"
  | "multiVoiceEdit" | "multiTrackView" | "onToggleMultiTrackView"
  | "onFileIoPanelOpen" | "onTrackPanelOpen" | "onCommandPaletteOpen"
  | "onStylesheetPanelOpen" | "onToolOpen" | "onDisplayModeChange" | "onZoomChange"
> & { onMouseDown: MouseEventHandler<HTMLElement> };

const displayModes: Array<[DisplayMode, string, string]> = [
  ["vertical-page", t("mode.short.verticalPage"), t("mode.name.verticalPage")],
  ["horizontal-page", t("mode.short.horizontalPage"), t("mode.name.horizontalPage")],
  ["grid", t("mode.short.grid"), t("mode.name.grid")],
  ["parchment", t("mode.short.parchment"), t("mode.name.parchment")],
  ["vertical-screen", t("mode.short.verticalScreen"), t("mode.name.verticalScreen")],
  ["horizontal-screen", t("mode.short.horizontalScreen"), t("mode.name.horizontalScreen")]
];

export function TopToolbar(props: TopToolbarProps) {
  const toolbarRef = useRef<HTMLElement>(null);
  const requiredRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const currentTrack = props.score.tracks.find((track) => track.id === props.cursor.trackId);
  const zoom = useViewStore((state) => state.zoom);
  const displayMode = useViewStore((state) => state.displayMode);
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
      title: t("toolbar.view"),
      className: "toolbarViewGroup",
      actions: [
        { id: "view.zoomOut", label: "−", title: title(t("toolbar.zoomOut"), "view.zoomOut"), run: () => props.onZoomChange(zoom - 10) },
        { id: "view.zoomIn", label: "+", title: title(t("toolbar.zoomIn"), "view.zoomIn"), run: () => props.onZoomChange(zoom + 10) },
        ...displayModes.map(([mode, label, name]) => ({
          id: mode,
          label,
          title: name,
          pressed: displayMode === mode,
          run: () => props.onDisplayModeChange(mode)
        })),
        { id: "playback.speedDown", label: "−", title: t("toolbar.speedDown"), run: () => props.dispatchCommand("playback.speedDown") },
        { id: "playback.speedUp", label: "+", title: t("toolbar.speedUp"), run: () => props.dispatchCommand("playback.speedUp") },
        { id: "file.print", label: "⎙", title: title(t("toolbar.print"), "file.print"), disabled: true }
      ]
    },
    {
      id: "panels",
      title: t("toolbar.panels"),
      className: "panelGroup",
      actions: [
        { id: "panels.palette", label: "◧", title: title(t("toolbar.palette"), "panels.palette"), run: () => props.togglePanel("palette") },
        { id: "panels.songInspector", label: "♫", title: title(t("toolbar.songInspector"), "panels.songInspector"), run: () => props.togglePanel("songInspector") },
        { id: "panels.trackInspector", label: "⚙", title: title(t("toolbar.trackInspector"), "panels.trackInspector"), run: () => props.togglePanel("trackInspector") },
        { id: "panels.globalView", label: "▤", title: title(t("toolbar.globalView"), "panels.globalView"), run: () => props.togglePanel("globalView") },
        { id: "panels.automation", label: "A", title: title(t("toolbar.automation"), "panels.automation"), run: () => props.togglePanel("automationView") }
      ]
    },
    {
      id: "tools",
      title: t("toolbar.tools"),
      className: "toolLaunchGroup",
      actions: [
        { id: "track.add", label: t("toolbar.short.trk"), title: title(t("toolbar.addTrack"), "track.add"), run: () => props.onTrackPanelOpen("wizard") },
        { id: "track.tuning", label: t("toolbar.short.tune"), title: t("tuning"), disabled: !currentTrack, run: () => props.onTrackPanelOpen("tuning") },
        { id: "track.voices", label: t("toolbar.short.vox"), title: title(t("toolbar.voices"), "voice.toggleMulti"), pressed: props.multiVoiceEdit, run: () => props.onTrackPanelOpen("voices") },
        { id: "track.drums", label: t("toolbar.short.kit"), title: t("toolbar.drumKit"), disabled: currentTrack?.icon !== "drums", run: () => props.onTrackPanelOpen("drums") },
        { id: "tools.commandPalette", label: t("toolbar.short.cmd"), title: title(t("toolbar.commandPalette"), "tools.commandPalette"), testId: "command-palette-open", run: () => props.onCommandPaletteOpen() },
        { id: "view.stylesheet", label: t("toolbar.short.style"), title: title(t("toolbar.scoreStylesheet"), "view.stylesheet"), run: props.onStylesheetPanelOpen },
        { id: "tools.chords", label: t("toolbar.short.chord"), title: title(t("toolbar.chordTool"), "tools.chords"), run: () => props.onToolOpen("chords") },
        { id: "tools.scales", label: t("toolbar.short.scale"), title: title(t("toolbar.scaleTool"), "tools.scales"), run: () => props.onToolOpen("scales") },
        { id: "tools.instrument", label: t("toolbar.short.fret"), title: title(t("toolbar.instrumentView"), "tools.instrument"), run: () => props.onToolOpen("instrument") },
        { id: "tools.tuner", label: t("toolbar.short.tune"), title: t("toolbar.tuner"), run: () => props.onToolOpen("tuner") },
        { id: "tools.transpose", label: t("toolbar.short.trans"), title: t("toolbar.transpose"), run: () => props.onToolOpen("transpose") },
        { id: "tools.cleanup", label: t("toolbar.short.check"), title: title(t("toolbar.checkBarDuration"), "tools.cleanup"), run: () => props.onToolOpen("cleanup") }
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
      <header ref={toolbarRef} className="toolbar" aria-label={t("toolbar.toolbar")} onMouseDown={props.onMouseDown}>
        <div ref={requiredRef} className="toolbarRequired">
          <div className="toolbarGroup homeGroup">
            <button type="button" title={t("toolbar.fileIO")} onClick={props.onFileIoPanelOpen}>{t("toolbar.file")}</button>
          </div>
          <div className="toolbarGroup historyGroup">
            <button type="button" aria-label={t("toolbar.undo")} title={title(t("toolbar.undo"), "history.undo")} onClick={() => props.dispatchCommand("history.undo")}>↶</button>
            <button type="button" aria-label={t("toolbar.redo")} title={title(t("toolbar.redo"), "history.redo")} onClick={() => props.dispatchCommand("history.redo")}>↷</button>
          </div>
          <div className="toolbarGroup transportGroup">
            <button type="button" aria-label={t("toolbar.firstBar")} title={t("toolbar.firstBar")} onClick={() => props.dispatchCommand("cursor.firstBar")}>|&lt;</button>
            <button type="button" aria-label={t("toolbar.previousBar")} title={title(t("toolbar.previousBar"), "playback.previousBar")} onClick={() => props.dispatchCommand("playback.previousBar")}>&lt;</button>
            <button type="button" title={t("toolbar.playStopSpace")} data-testid="transport-play-stop" onClick={() => props.dispatchCommand("playback.toggle")}>
              {(props.playbackStatus === "playing" || props.playbackStatus === "starting") ? t("toolbar.stop") : t("toolbar.play")}
            </button>
            <button type="button" aria-label={t("toolbar.nextBar")} title={title(t("toolbar.nextBar"), "playback.nextBar")} onClick={() => props.dispatchCommand("playback.nextBar")}>&gt;</button>
            <button type="button" aria-label={t("toolbar.lastBar")} title={t("toolbar.lastBar")} onClick={() => props.dispatchCommand("cursor.lastBar")}>&gt;|</button>
          </div>
          <div className="lcd" title={issue ? t("toolbar.voiceDuration", { voice: cursor.voiceIndex + 1, actual, expected }) : t("toolbar.barDurationOk")}>
            <span aria-hidden="true" className="trackColor" style={{ background: currentTrack?.color ?? "#64748b" }} />
            <strong>{currentTrack?.shortName ?? t("toolbar.track")}</strong>
            {tempoDraft === null ? (
              <button ref={tempoButton} type="button" className="lcdTempo" title={t("toolbar.editMeasureTempo")} data-testid="lcd-tempo" onClick={() => {
                tempoEditing.current = true;
                setTempoDraft(String(Math.round(props.currentTempo)));
              }}>
                ♩ {Math.round(props.currentTempo)}
              </button>
            ) : (
              <input
                className="lcdTempoInput"
                aria-label={t("toolbar.tempoBPM")}
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
            <button type="button" aria-label={props.multiTrackView ? t("toolbar.multiTrackView") : t("toolbar.singleTrackView")} aria-pressed={props.multiTrackView} className={props.multiTrackView ? "activeToggle" : ""} title={title(t("toolbar.multitrackView"), "view.multitrack")} onClick={props.onToggleMultiTrackView}>
              {props.multiTrackView ? t("toolbar.multi") : "1"}
            </button>
            <button type="button" disabled>♫</button>
            <button type="button" disabled>⚙</button>
          </div>
          <div className="toolbarGroup playbackTools">
            <button type="button" aria-label={t("toolbar.countIn")} aria-pressed={props.countInEnabled} className={props.countInEnabled ? "activeToggle" : ""} title={t("toolbar.countIn")} onClick={() => props.dispatchCommand("playback.countIn")}>C</button>
            <button type="button" aria-label={t("toolbar.metronome")} aria-pressed={props.metronomeEnabled} className={props.metronomeEnabled ? "activeToggle" : ""} title={t("toolbar.metronome")} onClick={() => props.dispatchCommand("playback.metronome")}>M</button>
            <button type="button" aria-label={t("toolbar.loop")} aria-pressed={props.loopEnabled} className={props.loopEnabled ? "activeToggle" : ""} title={title(t("toolbar.loop"), "playback.loop")} onClick={() => props.dispatchCommand("playback.loop")}>{t("toolbar.loop")}</button>
            {props.playbackStatus === "playing" ? (
              <PlaybackReadout barIndex={props.playbackBarIndex} />
            ) : (
              <span className="playbackReadout">{t("toolbar.readyAtBar", { bar: cursor.barIndex + 1 })}</span>
            )}
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
      <p className="toolbarNarrowNotice">{t("toolbar.minimumWidthNotice")}</p>
    </div>
  );
}

function PlaybackReadout({ barIndex }: { barIndex: number }) {
  const seconds = usePlaybackStore((state) => state.currentTimeSec.toFixed(1));
  return <span className="playbackReadout">{t("toolbar.playingAtBar", { bar: barIndex + 1, seconds })}</span>;
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
          aria-label={measuring ? undefined : action.title}
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
