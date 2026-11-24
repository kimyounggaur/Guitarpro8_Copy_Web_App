import { memo, useCallback, useLayoutEffect, useRef } from "react";
import type { TrackMixerState } from "../../engine/audio/mixer";
import type { MasterBar, Track } from "../../model/types";
import { usePlaybackStore } from "../../store/playbackStore";
import { useViewStore } from "../../store/viewStore";
import { t } from "../i18n/messages.en";
import type { EditorShellProps } from "./EditorShell";
import { mixerRangeEvents } from "./mixerControls";

const measureWidth = 42;

const MeasureNumbers = memo(function MeasureNumbers({ bars }: { bars: MasterBar[] }) {
  return <div className="globalMeasureRow globalMeasureLabels">
    {bars.map((bar, index) => (
      <span className="globalHeader" key={index} title={bar.section?.name}>
        {index + 1}{bar.section?.letter && <small>{bar.section.letter}</small>}
      </span>
    ))}
  </div>;
});

interface MeasureRowProps {
  track: Pick<Track, "id" | "name" | "color">;
  count: number;
  cursor: number;
  playing: number;
  first?: number;
  last?: number;
  jump: EditorShellProps["onGlobalJump"];
}

const MeasureRow = memo(function MeasureRow({ track, count, cursor, playing, first, last, jump }: MeasureRowProps) {
  return <div className="globalMeasureRow">
    {Array.from({ length: count }, (_, index) => (
      <button key={index} type="button" className={[
        "globalCell",
        index === cursor ? "activeCell" : "",
        index === playing ? "playingCell" : "",
        first !== undefined && last !== undefined && index >= first && index <= last ? "selectedCell" : ""
      ].filter(Boolean).join(" ")}
        aria-label={t("editor.trackMeasure", { track: track.name, measure: index + 1 })}
        aria-current={index === cursor ? "location" : undefined}
        onClick={() => jump(track.id, index)}>
        <span style={{ backgroundColor: track.color }} />
      </button>
    ))}
  </div>;
});

export function GlobalViewDock(props: EditorShellProps) {
  const onJump = useRef(props.onGlobalJump);
  useLayoutEffect(() => { onJump.current = props.onGlobalJump; }, [props.onGlobalJump]);
  const jump = useCallback((id: string, bar: number) => onJump.current(id, bar), []);
  const selection = useViewStore((state) => state.selection);
  const setMasterVolume = usePlaybackStore((state) => state.setMasterVolume);
  const masterVolumePreview = usePlaybackStore((state) => state.masterVolumePreview);
  const barCount = props.score.masterBars.length;
  const selectionTracks = selection ? [selection.anchor.trackId, selection.head.trackId].map((id) =>
    props.score.tracks.findIndex((track) => track.id === id)) : [];
  const barRange = selection ? [
    Math.min(selection.anchor.barIndex, selection.head.barIndex),
    Math.max(selection.anchor.barIndex, selection.head.barIndex)
  ] : null;
  const volume = masterVolumePreview ?? props.mixer.master.volume;

  return (
    <section className="globalView alignedGlobalView" aria-label={t("editor.globalView")}>
      <div className="globalAlignedGrid" style={{ gridTemplateColumns: `var(--global-track-width) ${barCount * measureWidth}px` }}>
        <div className="globalPinned globalTop globalMasterRow">
          <button type="button" onClick={() => props.onTrackPanelOpen("wizard")}>{t("editor.addTrackButton")}</button>
          <label className="globalMiniFader">Vol
            <input type="range" aria-label="Master volume" min="0" max="1" step="0.01" value={volume}
              {...mixerRangeEvents(setMasterVolume)} />
          </label>
          <label className="globalMiniFader">Focus
            <input type="range" aria-label="Master focus" min="-100" max="100" step="1"
              value={props.mixer.master.focusPercent} {...mixerRangeEvents(props.onMasterFocusChange)} />
          </label>
        </div>
        <MeasureNumbers bars={props.score.masterBars} />
        {props.score.tracks.flatMap((track, index) => {
          const options = props.mixer.tracks[track.id];
          const inSelection = barRange !== null && index >= Math.min(...selectionTracks) && index <= Math.max(...selectionTracks);
          const active = track.id === props.cursor.trackId;
          return [
            <TrackHeader key={`track-${track.id}`} track={track} mixer={options} active={active} props={props} />,
            <MeasureRow key={`measures-${track.id}`} track={track} count={barCount} cursor={active ? props.cursor.barIndex : -1}
              playing={props.playbackStatus === "playing" ? props.playbackBarIndex : -1}
              first={inSelection ? barRange[0] : undefined} last={inSelection ? barRange[1] : undefined} jump={jump} />
          ];
        })}
      </div>
    </section>
  );
}

function TrackHeader({ track, mixer, active, props }: {
  track: Track; mixer?: TrackMixerState; active: boolean; props: EditorShellProps
}) {
  const change = (patch: Partial<TrackMixerState>) => props.onMixerTrackChange(track.id, patch);
  return (
    <div className={`globalPinned globalTrackRow ${active ? "globalTrackRowActive" : ""}`} data-track-id={track.id}>
      <button type="button" title={track.name} className="globalTrackName"
        onClick={() => props.onGlobalJump(track.id, props.cursor.barIndex)}>
        <span className="globalTrackSwatch" style={{ backgroundColor: track.color }} />
        <strong>{track.shortName || track.name}</strong>
      </button>
      <button type="button" disabled={!mixer} title={t("editor.visible")} aria-label={t("editor.visible")}
        aria-pressed={mixer?.visible} onClick={() => change({ visible: !mixer?.visible })}><span aria-hidden="true">V</span></button>
      <button type="button" disabled={!mixer} title={t("editor.mute")} aria-label={t("editor.mute")}
        aria-pressed={mixer?.mute} onClick={() => change({ mute: !mixer?.mute })}><span aria-hidden="true">M</span></button>
      <button type="button" disabled={!mixer} title={t("editor.solo")} aria-label={t("editor.solo")}
        aria-pressed={mixer?.solo} onClick={() => change({ solo: !mixer?.solo })}><span aria-hidden="true">S</span></button>
      <button type="button" disabled={!mixer} title={t("editor.volumeAutomation")} aria-label={`${t("editor.volumeAutomation")} (A Vol)`}
        aria-pressed={mixer?.volumeAutomationEnabled} onClick={() => change({ volumeAutomationEnabled: !mixer?.volumeAutomationEnabled })}><span aria-hidden="true">AV</span></button>
      <button type="button" disabled={!mixer} title={t("editor.panAutomation")} aria-label={`${t("editor.panAutomation")} (A Pan)`}
        aria-pressed={mixer?.panAutomationEnabled} onClick={() => change({ panAutomationEnabled: !mixer?.panAutomationEnabled })}><span aria-hidden="true">AP</span></button>
      <input className="globalTrackFader" aria-label={`${track.name} volume`} title={t("editor.vol")} type="range"
        min="0" max="1" step="0.01" value={mixer?.volume ?? 0} disabled={!mixer}
        {...mixerRangeEvents((volume, phase) => props.onMixerTrackChange(track.id, { volume }, phase))} />
      <input className="globalTrackFader" aria-label={`${track.name} pan`} title={t("editor.pan")} type="range"
        min="-1" max="1" step="0.01" value={mixer?.pan ?? 0} disabled={!mixer}
        {...mixerRangeEvents((pan, phase) => props.onMixerTrackChange(track.id, { pan }, phase))} />
    </div>
  );
}
