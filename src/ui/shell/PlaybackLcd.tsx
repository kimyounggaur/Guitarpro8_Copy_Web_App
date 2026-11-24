import { useRef, useState } from "react";
import { barTheoreticalTicks, beatDurationTicks } from "../../model/derive";
import { usePlaybackStore } from "../../store/playbackStore";
import { AppIcon, IconButton, Menu, MenuItem, Popover, ToolbarButton } from "../components";
import { t } from "../i18n/messages.en";
import type { EditorShellProps } from "./EditorShell";

export function SpeedControl({ speed }: { speed: number }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const setSpeed = usePlaybackStore((state) => state.setSpeedPercent);
  return (
    <div className="toolbarPopup">
      <button
        ref={anchor}
        className="speedReadout"
        type="button"
        aria-label={t("toolbar.speedValue", { speed })}
        aria-expanded={open}
        title={t("toolbar.playbackSpeed")}
        onClick={() => setOpen(!open)}
      >
        <AppIcon name="speed" size={15} />
        {speed}%
      </button>
      <Popover open={open} anchor={anchor} label={t("toolbar.playbackSpeed")} onClose={() => setOpen(false)}>
        <label className="speedField">
          {t("toolbar.speedRange")}
          <input
            type="range"
            min={25}
            max={200}
            step={5}
            value={Math.min(200, Math.max(25, speed))}
            onChange={(event) => setSpeed(event.currentTarget.valueAsNumber)}
          />
        </label>
        <div className="speedSteps">
          <button type="button" disabled={speed <= 25} onClick={() => setSpeed(Math.max(25, speed - 5))}>
            {t("toolbar.speedDown")}
          </button>
          <button type="button" onClick={() => setSpeed(100)}>
            {t("toolbar.normalSpeed")}
          </button>
          <button type="button" disabled={speed >= 200} onClick={() => setSpeed(Math.min(200, speed + 5))}>
            {t("toolbar.speedUp")}
          </button>
        </div>
      </Popover>
    </div>
  );
}

export function PlaybackLcd(
  props: Pick<
    EditorShellProps,
    | "score"
    | "cursor"
    | "currentTempo"
    | "onTempoChange"
    | "onGlobalJump"
    | "playbackStatus"
    | "playbackBarIndex"
    | "dispatchCommand"
    | "countInEnabled"
    | "metronomeEnabled"
    | "multiTrackView"
    | "onToggleMultiTrackView"
    | "togglePanel"
  >
) {
  const trackAnchor = useRef<HTMLButtonElement>(null),
    settings = useRef<HTMLButtonElement>(null),
    tempo = useRef<HTMLButtonElement>(null);
  const [popup, setPopup] = useState<"track" | "settings" | null>(null),
    [draft, setDraft] = useState<string | null>(null);
  const edited = useRef(false),
    editing = useRef(false);
  const { cursor } = props;
  const track = props.score.tracks.find(({ id }) => id === cursor.trackId);
  const master = props.score.masterBars[cursor.barIndex];
  const actual =
    track?.bars[cursor.barIndex]?.voices[cursor.voiceIndex]?.beats.reduce(
      (sum, beat) => sum + beatDurationTicks(beat),
      0
    ) ?? 0;
  const expected = master ? barTheoreticalTicks(master) : 0;
  const note = t("toolbar.voiceDuration", { voice: cursor.voiceIndex + 1, actual, expected });
  function finish(value?: string) {
    if (!editing.current) return;
    editing.current = false;
    setDraft(null);
    if (edited.current && value?.trim() && Number.isFinite(Number(value))) props.onTempoChange(Number(value));
    edited.current = false;
  }
  return (
    <div className="lcd" data-required style={{ order: 8 }}>
      <div className="lcdTrack">
        <button
          type="button"
          ref={trackAnchor}
          aria-label={t("toolbar.chosenTrack", { name: track?.shortName ?? t("editor.track") })}
          title={t("toolbar.selectTrack")}
          aria-haspopup="menu"
          aria-expanded={popup === "track"}
          onClick={() => setPopup(popup === "track" ? null : "track")}
        >
          <span className="trackColor" style={{ background: track?.color }} />
          <strong>{track?.shortName ?? t("editor.track")}</strong>
          <AppIcon name="down" size={10} />
        </button>
        <Popover
          open={popup === "track"}
          anchor={trackAnchor}
          onClose={() => setPopup(null)}
          label={t("toolbar.selectTrack")}
        >
          <Menu
            label={t("toolbar.selectTrack")}
            onClose={() => {
              setPopup(null);
              trackAnchor.current?.focus();
            }}
          >
            {props.score.tracks.map((item) => (
              <MenuItem
                key={item.id}
                checked={item.id === track?.id}
                onClick={() => {
                  props.onGlobalJump(item.id, cursor.barIndex);
                  setPopup(null);
                  trackAnchor.current?.focus();
                }}
              >
                {item.name}
              </MenuItem>
            ))}
          </Menu>
        </Popover>
      </div>
      <div className="lcdMeasure">
        <span
          tabIndex={actual !== expected ? 0 : undefined}
          title={actual === expected ? t("toolbar.barDurationOk") : note}
          aria-label={note}
          className={actual !== expected ? "lcdWarning" : undefined}
        >
          {Math.round(actual)}/{Math.round(expected)}
        </span>
        {props.playbackStatus === "playing" ? (
          <PlaybackReadout bar={props.playbackBarIndex + 1} />
        ) : (
          <small>{t("toolbar.barBeat", { bar: cursor.barIndex + 1, beat: cursor.beatIndex + 1 })}</small>
        )}
      </div>
      {draft === null ? (
        <button
          ref={tempo}
          type="button"
          className="lcdTempo"
          title={t("toolbar.editMeasureTempo")}
          data-testid="lcd-tempo"
          onClick={() => {
            editing.current = true;
            setDraft(String(props.currentTempo));
          }}
        >
          ♩ {+props.currentTempo.toFixed(1)}
        </button>
      ) : (
        <input
          className="lcdTempoInput"
          aria-label={t("toolbar.tempoBPM")}
          type="number"
          min={10}
          max={300}
          step="0.1"
          autoFocus
          value={draft}
          onChange={(event) => {
            edited.current = true;
            setDraft(event.target.value);
          }}
          onBlur={(event) => finish(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Escape") {
              event.preventDefault();
              finish(event.key === "Enter" ? event.currentTarget.value : undefined);
              requestAnimationFrame(() => tempo.current?.focus());
            }
          }}
        />
      )}
      <ToolbarButton
        commandId="playback.countIn"
        dispatch={props.dispatchCommand}
        label={t("toolbar.countIn")}
        icon="count"
        pressed={props.countInEnabled}
      />
      <ToolbarButton
        commandId="playback.metronome"
        dispatch={props.dispatchCommand}
        label={t("toolbar.metronome")}
        icon="metronome"
        pressed={props.metronomeEnabled}
      />
      <IconButton
        ref={settings}
        label={t("toolbar.playbackSettings")}
        icon="settings"
        aria-expanded={popup === "settings"}
        onClick={() => setPopup(popup === "settings" ? null : "settings")}
      />
      <Popover
        open={popup === "settings"}
        anchor={settings}
        label={t("toolbar.playbackSettings")}
        onClose={() => setPopup(null)}
      >
        <div className="lcdSettings">
          <button type="button" aria-pressed={props.multiTrackView} onClick={props.onToggleMultiTrackView}>
            {t("toolbar.multitrackView")}
          </button>
          <button
            type="button"
            onClick={() => {
              setPopup(null);
              props.togglePanel("automationView");
            }}
          >
            {t("toolbar.automation")}
          </button>
        </div>
      </Popover>
    </div>
  );
}

function PlaybackReadout({ bar }: { bar: number }) {
  const seconds = usePlaybackStore((state) => state.currentTimeSec.toFixed(1));
  return <small>{t("toolbar.playingAtBar", { bar, seconds })}</small>;
}
