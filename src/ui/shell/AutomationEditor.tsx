import type { MouseEvent } from "react";
import { barTheoreticalTicks } from "../../model/derive";
import { TICKS_PER_QUARTER, type AutomationPoint, type Score } from "../../model/types";
import { t } from "../i18n/messages.en";
import type { AutomationLaneId, EditorShellProps } from "./EditorShell";

interface AutomationLaneConfig {
  id: AutomationLaneId;
  label: string;
  min: number;
  max: number;
  points: AutomationPoint[];
}

export function AutomationEditor(props: EditorShellProps) {
  const currentTrack = props.score.tracks.find((track) => track.id === props.cursor.trackId) ?? null;
  const totalTicks = Math.max(
    TICKS_PER_QUARTER,
    props.score.masterBars.reduce((sum, masterBar) => sum + barTheoreticalTicks(masterBar), 0)
  );
  const lanes: AutomationLaneConfig[] = [
    {
      id: "tempo",
      label: t("tempo"),
      min: 40,
      max: 220,
      points: automationPoints(props.score.masterAutomations, "tempo", "master")
    },
    {
      id: "masterVolume",
      label: t("editor.mVol"),
      min: 0,
      max: 1,
      points: automationPoints(props.score.masterAutomations, "volume", "master")
    },
    {
      id: "masterPan",
      label: t("editor.mPan"),
      min: -1,
      max: 1,
      points: automationPoints(props.score.masterAutomations, "pan", "master")
    },
    {
      id: "trackVolume",
      label: t("editor.tVol"),
      min: 0,
      max: 1,
      points: currentTrack ? automationPoints(currentTrack.automations, "volume", "track") : []
    },
    {
      id: "trackPan",
      label: t("editor.tPan"),
      min: -1,
      max: 1,
      points: currentTrack ? automationPoints(currentTrack.automations, "pan", "track") : []
    }
  ];

  return (
    <section className="automationEditor" aria-label={t("editor.automationEditor")}>
      {lanes.map((lane) => (
        <div key={lane.id} className="automationRow">
          <strong>{lane.label}</strong>
          <div
            className="automationLane"
            role="button"
            tabIndex={0}
            onClick={(event) => handleAutomationLaneClick(event, lane, totalTicks, props)}
          >
            {lane.points.map((point, index) => (
              <button
                key={`${lane.id}-${point.tick}-${index}`}
                type="button"
                className={`automationPoint ${point.transition}`}
                style={{
                  left: `${pointLeft(point.tick, totalTicks)}%`,
                  top: `${pointTop(normalizeAutomationPointValue(lane.id, point.value), lane)}%`
                }}
                title={`${lane.label} ${formatAutomationValue(lane.id, point.value)} ${point.transition}`}
                onClick={(event) => {
                  event.stopPropagation();

                  if (event.shiftKey) {
                    props.onAutomationPointRemove(lane.id, point.tick);
                  } else {
                    props.onAutomationTransitionToggle(lane.id, point.tick);
                  }
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function handleAutomationLaneClick(
  event: MouseEvent<HTMLDivElement>,
  lane: AutomationLaneConfig,
  totalTicks: number,
  props: EditorShellProps
): void {
  const bounds = event.currentTarget.getBoundingClientRect();
  const xRatio = clamp((event.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
  const yRatio = clamp((event.clientY - bounds.top) / Math.max(1, bounds.height), 0, 1);
  const tick = xRatio * totalTicks;
  const value = roundAutomationValue(lane.id, lane.min + (1 - yRatio) * (lane.max - lane.min));

  props.onAutomationPointSet(lane.id, tick, value);
}

function automationPoints(
  automations: Score["masterAutomations"],
  type: "tempo" | "volume" | "pan",
  scope: "master" | "track"
): AutomationPoint[] {
  return automations.find((automation) => automation.type === type && automation.scope === scope)?.points ?? [];
}

function pointLeft(tick: number, totalTicks: number): number {
  return clamp((tick / totalTicks) * 100, 0, 100);
}

function pointTop(value: number, lane: AutomationLaneConfig): number {
  return clamp(100 - ((value - lane.min) / (lane.max - lane.min)) * 100, 0, 100);
}

function normalizeAutomationPointValue(lane: AutomationLaneId, value: number): number {
  if (lane === "tempo") {
    return value;
  }

  if (lane === "masterVolume" || lane === "trackVolume") {
    return value > 1.6 ? value / 100 : value;
  }

  return Math.abs(value) > 1 ? value / 100 : value;
}

function roundAutomationValue(lane: AutomationLaneId, value: number): number {
  if (lane === "tempo") {
    return Math.round(value);
  }

  return Math.round(value * 100) / 100;
}

function formatAutomationValue(lane: AutomationLaneId, value: number): string {
  const normalized = normalizeAutomationPointValue(lane, value);

  if (lane === "tempo") {
    return `${Math.round(normalized)} bpm`;
  }

  return `${Math.round(normalized * 100)}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
