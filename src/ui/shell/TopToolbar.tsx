import { useLayoutEffect, useRef, useState, type MouseEventHandler, type RefObject } from "react";
import { shortcutLabel } from "../../commands/keymap";
import { PlaybackLcd, SpeedControl } from "./PlaybackLcd";
import type { DisplayMode } from "../../model/types";
import { useViewStore } from "../../store/viewStore";
import { IconButton, ToolbarButton, type IconName } from "../components";
import { t } from "../i18n/messages.en";
import type { EditorShellProps } from "./EditorShell";
import { useLineInput } from "./useLineInput";
import { ToolbarOverflowMenu, type ToolbarAction, type ToolbarGroup } from "./ToolbarOverflowMenu";

type TopToolbarProps = Pick<
  EditorShellProps,
  | "score"
  | "cursor"
  | "platform"
  | "dispatchCommand"
  | "togglePanel"
  | "panelVisibility"
  | "undoCount"
  | "redoCount"
  | "countInEnabled"
  | "metronomeEnabled"
  | "loopEnabled"
  | "speedPercent"
  | "playbackStatus"
  | "playbackBarIndex"
  | "currentTempo"
  | "onTempoChange"
  | "onGlobalJump"
  | "multiVoiceEdit"
  | "multiTrackView"
  | "onToggleMultiTrackView"
  | "onConcertToneToggle"
  | "onExportFile"
  | "onFileIoPanelOpen"
  | "onTrackPanelOpen"
  | "onCommandPaletteOpen"
  | "onStylesheetPanelOpen"
  | "onToolOpen"
  | "onDisplayModeChange"
  | "onZoomChange"
> & {
  onMouseDown: MouseEventHandler<HTMLElement>;
  onHomeOpen?: () => void;
  onAudioDockToggle?: () => void;
  audioDockOpen?: boolean;
};

const displayModes = [
  ["vertical-page", "page", t("mode.name.verticalPage")],
  ["horizontal-page", "landscape", t("mode.name.horizontalPage")],
  ["grid", "grid", t("mode.name.grid")],
  ["parchment", "parchment", t("mode.name.parchment")],
  ["vertical-screen", "screen", t("mode.name.verticalScreen")],
  ["horizontal-screen", "horizontal", t("mode.name.horizontalScreen")]
] as const satisfies ReadonlyArray<readonly [DisplayMode, IconName, string]>;

function ActionButton({ action }: { action: ToolbarAction }) {
  return (
    <ToolbarButton
      commandId={action.id}
      dispatch={action.run}
      label={action.label}
      icon={action.icon}
      shortcut={action.shortcut}
      disabled={action.disabled}
      pressed={action.pressed}
      data-testid={action.testId}
    />
  );
}

export function TopToolbar(props: TopToolbarProps) {
  const lineInput = useLineInput();
  const toolbar = useRef<HTMLElement>(null);
  const zoom = useViewStore((state) => state.zoom),
    displayMode = useViewStore((state) => state.displayMode);
  const track = props.score.tracks.find(({ id }) => id === props.cursor.trackId);
  const playing = props.playbackStatus === "playing" || props.playbackStatus === "starting";
  const visibility = props.panelVisibility;
  function action(
    id: string,
    label: string,
    icon: IconName,
    run: () => void = () => props.dispatchCommand(id),
    options: Partial<Pick<ToolbarAction, "disabled" | "pressed" | "testId">> = {}
  ): ToolbarAction {
    return { id, label, icon, run, shortcut: shortcutLabel(id, props.platform), ...options };
  }
  const panels = [
    action("panels.palette", t("toolbar.palette"), "palette", () => props.togglePanel("palette"), {
      pressed: visibility.palette
    }),
    action(
      "panels.songInspector",
      t("toolbar.songInspector"),
      "song",
      () => props.togglePanel("songInspector"),
      { pressed: visibility.songInspector }
    ),
    action(
      "panels.trackInspector",
      t("toolbar.trackInspector"),
      "inspector",
      () => props.togglePanel("trackInspector"),
      { pressed: visibility.trackInspector }
    ),
    action("panels.globalView", t("toolbar.globalView"), "global", () => props.togglePanel("globalView"), {
      pressed: visibility.globalView
    }),
    action(
      "panels.automation",
      t("toolbar.automation"),
      "automation",
      () => props.togglePanel("automationView"),
      { pressed: visibility.automationView }
    )
  ];
  const groups: ToolbarGroup[] = [
    {
      id: "zoom",
      title: t("toolbar.zoom"),
      order: 3,
      actions: [
        action("view.zoomOut", t("toolbar.zoomOut"), "zoomOut", () => props.onZoomChange(zoom - 5)),
        action("view.zoomIn", t("toolbar.zoomIn"), "zoomIn", () => props.onZoomChange(zoom + 5))
      ]
    },
    {
      id: "display",
      title: t("toolbar.view"),
      order: 4,
      actions: displayModes.map(([mode, icon, name]) =>
        action(mode, name, icon, () => props.onDisplayModeChange(mode), { pressed: displayMode === mode })
      )
    },
    {
      id: "print",
      title: t("toolbar.print"),
      order: 6,
      actions: [action("file.print", t("toolbar.print"), "print", () => props.onExportFile("pdf"))]
    },
    {
      id: "tonality",
      title: t("toolbar.globalTonality"),
      order: 10,
      actions: [
        action("tools.globalTonality", t("toolbar.globalTonality"), "transpose", () =>
          props.onToolOpen("transpose")
        ),
        action("track.concertTone", t("editor.concertTone"), "key", props.onConcertToneToggle, {
          pressed: props.score.documentSettings.concertTone
        })
      ]
    },
    ...(props.onAudioDockToggle
      ? [
          {
            id: "audio",
            title: t("toolbar.audioDock"),
            order: 11,
            actions: [
              action("audio.dock", t("toolbar.audioDock"), "audio", props.onAudioDockToggle, {
                pressed: !!props.audioDockOpen
              })
            ]
          }
        ]
      : []),
    {
      id: "instruments",
      title: t("instrument"),
      order: 12,
      actions: [
        action("tools.instrument", t("toolbar.instrumentView"), "instrument", () =>
          props.onToolOpen("instrument")
        ),
        action("track.drums", t("toolbar.drumKit"), "drums", () => props.onTrackPanelOpen("drums"), {
          disabled: track?.icon !== "drums"
        })
      ]
    },
    {
      id: "tuner",
      title: t("toolbar.tuner"),
      order: 13,
      actions: [action("tools.tuner", t("toolbar.tuner"), "tuner", () => props.onToolOpen("tuner"))]
    },
    {
      id: "input",
      title: t("toolbar.lineIn"),
      order: 14,
      actions: [
        action("audio.lineIn", t("toolbar.lineIn"), "audio", () => void lineInput.toggle(), {
          pressed: lineInput.active
        })
      ]
    },
    {
      id: "tools",
      title: t("toolbar.tools"),
      order: 15,
      actions: [
        action("track.add", t("toolbar.addTrack"), "addTrack", () => props.onTrackPanelOpen("wizard")),
        action("track.tuning", t("tuning"), "tuning", () => props.onTrackPanelOpen("tuning"), {
          disabled: !track
        }),
        action("track.voices", t("toolbar.voices"), "voices", () => props.onTrackPanelOpen("voices"), {
          pressed: props.multiVoiceEdit
        }),
        action(
          "tools.commandPalette",
          t("toolbar.commandPalette"),
          "command",
          () => props.onCommandPaletteOpen(),
          { testId: "command-palette-open" }
        ),
        action("view.stylesheet", t("toolbar.scoreStylesheet"), "style", props.onStylesheetPanelOpen),
        action("tools.chords", t("toolbar.chordTool"), "chord", () => props.onToolOpen("chords")),
        action("tools.scales", t("toolbar.scaleTool"), "scale", () => props.onToolOpen("scales")),
        action("tools.transpose", t("toolbar.transpose"), "transpose", () => props.onToolOpen("transpose")),
        action("tools.cleanup", t("toolbar.checkBarDuration"), "check", () => props.onToolOpen("cleanup"))
      ]
    }
  ];
  const fit = useToolbarCapacity(toolbar, groups.map((g) => g.actions.length).join(","));
  const command = (entry: ToolbarAction) => <ActionButton key={entry.id} action={entry} />;
  return (
    <div className="toolbarShell">
      <header
        ref={toolbar}
        className="toolbar"
        aria-label={t("toolbar.toolbar")}
        onMouseDown={props.onMouseDown}
      >
        <div className="toolbarGroup" data-required style={{ order: 1 }}>
          {props.onHomeOpen && command(action("app.home", t("toolbar.home"), "home", props.onHomeOpen))}
          {command(action("file.panel", t("toolbar.fileIO"), "file", props.onFileIoPanelOpen))}
        </div>
        <div className="toolbarGroup" data-required aria-label={t("toolbar.panels")} style={{ order: 2 }}>
          {panels.map(command)}
        </div>
        <div className="toolbarGroup" data-required style={{ order: 5 }}>
          {command(
            action("history.undo", t("toolbar.undo"), "undo", undefined, { disabled: props.undoCount === 0 })
          )}
          {command(
            action("history.redo", t("toolbar.redo"), "redo", undefined, { disabled: props.redoCount === 0 })
          )}
        </div>
        <div className="toolbarGroup transportGroup" data-required style={{ order: 7 }}>
          {command(action("cursor.firstBar", t("toolbar.firstBar"), "first"))}
          {command(action("playback.previousBar", t("toolbar.previousBar"), "previous"))}
          {command(
            action(
              "playback.toggle",
              playing ? t("toolbar.stop") : t("toolbar.play"),
              playing ? "stop" : "play",
              undefined,
              { pressed: playing, testId: "transport-play-stop" }
            )
          )}
          {command(action("playback.nextBar", t("toolbar.nextBar"), "next"))}
          {command(action("cursor.lastBar", t("toolbar.lastBar"), "last"))}
        </div>
        <PlaybackLcd {...props} />
        <div className="toolbarGroup" data-required style={{ order: 9 }}>
          {command(
            action("playback.loop", t("toolbar.loop"), "loop", undefined, { pressed: props.loopEnabled })
          )}
          <SpeedControl speed={props.speedPercent} />
        </div>
        {groups.slice(0, fit).map((group) => (
          <div
            key={group.id}
            className="toolbarGroup"
            data-toolbar-group={group.id}
            data-audio-linked={(group.id === "audio" && !!props.score.audioTrack) || undefined}
            style={{ order: group.order }}
          >
            {group.actions.map(command)}
          </div>
        ))}
        {fit < groups.length && <ToolbarOverflowMenu groups={groups.slice(fit)} />}
      </header>
      {lineInput.error && (
        <div role="alert" className="toolbarInputMessage">
          {lineInput.error}
          <IconButton
            label={t("toolbar.dismissNotice")}
            icon="close"
            size="xs"
            onClick={lineInput.dismissError}
          />
        </div>
      )}
      <p className="toolbarNarrowNotice">{t("toolbar.minimumWidthNotice")}</p>
    </div>
  );
}

function useToolbarCapacity(ref: RefObject<HTMLElement>, groupCounts: string) {
  const [count, setCount] = useState(0);
  useLayoutEffect(() => {
    const toolbar = ref.current;
    if (!toolbar) return;
    const required = [...toolbar.querySelectorAll<HTMLElement>("[data-required]")];
    function measure() {
      if (!toolbar) return;
      const style = getComputedStyle(toolbar);
      const gap = parseFloat(style.columnGap),
        buttonWidth = parseFloat(style.getPropertyValue("--toolbar-icon-width"));
      const groupGap = parseFloat(style.getPropertyValue("--toolbar-action-gap"));
      const groupEnd = parseFloat(style.getPropertyValue("--toolbar-group-end")) + 1;
      const fixed = required.reduce((width, group) => width + group.getBoundingClientRect().width + gap, 0);
      const room =
        toolbar.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - fixed;
      const widths = groupCounts
        .split(",")
        .map(Number)
        .map((n) => n * buttonWidth + (n - 1) * groupGap + groupEnd + gap);
      if (widths.reduce((a, b) => a + b, 0) - gap <= room) {
        setCount(widths.length);
        return;
      }
      let available = room - buttonWidth;
      let visible = 0;
      for (const width of widths) {
        if (width > available) break;
        visible++;
        available -= width;
      }
      setCount(visible);
    }
    const observer = new ResizeObserver(measure);
    observer.observe(toolbar);
    required.forEach((item) => observer.observe(item));
    measure();
    return () => observer.disconnect();
  }, [ref, groupCounts]);
  return count;
}
