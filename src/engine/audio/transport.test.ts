import { describe, expect, it, vi } from "vitest";
import type { SchedulerPlayOptions } from "./scheduler";
import { PlaybackTransport, type TransportStatus } from "./transport";

function mockTransport() {
  const sessions: SchedulerPlayOptions[] = [];
  const started: Array<() => void> = [];
  const statuses: TransportStatus[] = [];
  const backend = {
    stop: vi.fn(),
    seek: vi.fn(),
    play: vi.fn((options: SchedulerPlayOptions) => {
      sessions.push(options);
      return new Promise<void>((resolve) => started.push(resolve));
    })
  };
  const plan = {
    totalSeconds: 20,
    countInSeconds: 0,
    events: [],
    ticksToSeconds: (tick: number) => tick / 480,
    onPosition: vi.fn(),
    onEnded: vi.fn()
  };
  const transport = new PlaybackTransport(backend, (status) => statuses.push(status));
  return { backend, transport, statuses, plan, sessions, started };
}

describe("[A7] playback transport", () => {
  it("rejects delayed signals and launch resolution from a superseded session", async () => {
    const { transport, statuses, plan, sessions, started } = mockTransport();
    const first = transport.play(0, plan);
    const second = transport.play(960, plan);
    expect(sessions[1].sessionId).toBeGreaterThan(sessions[0].sessionId);
    expect(sessions[1].startSec).toBe(2);

    sessions[0].onPosition({ timeSec: 7, sessionId: sessions[0].sessionId });
    sessions[0].onEnded(sessions[0].sessionId);
    started[0]();
    await first;
    expect(plan.onPosition).not.toHaveBeenCalled();
    expect(plan.onEnded).not.toHaveBeenCalled();
    expect(statuses).toEqual(["starting"]);

    started[1]();
    await second;
    sessions[1].onPosition({ timeSec: 3, sessionId: sessions[1].sessionId });
    expect(plan.onPosition).toHaveBeenCalledWith(3);
    sessions[1].onEnded(sessions[1].sessionId);
    expect(statuses).toEqual(["starting", "playing", "stopped"]);
    expect(plan.onEnded).toHaveBeenCalledOnce();
  });

  it("seeks within the running session without stopping and handles pause", async () => {
    const { backend, transport, statuses, plan, sessions, started } = mockTransport();
    const launch = transport.play(0, plan);
    started[0]();
    await launch;

    transport.seek(1440);
    expect(backend.seek).toHaveBeenCalledWith(3, sessions[0].sessionId);
    expect(backend.stop).not.toHaveBeenCalled();
    expect(statuses).toEqual(["starting", "playing"]);

    transport.pause();
    sessions[0].onEnded(sessions[0].sessionId);
    expect(statuses).toEqual(["starting", "playing", "paused"]);
    expect(plan.onEnded).not.toHaveBeenCalled();
    transport.stop();
    expect(statuses).toEqual(["starting", "playing", "paused", "stopped"]);
  });

  it("cancels a starting session and ignores the pending launch when it completes", async () => {
    const { backend, transport, statuses, plan, sessions, started } = mockTransport();
    const launch = transport.play(0, plan);
    transport.seek(480);
    expect(backend.seek).toHaveBeenCalledWith(1, sessions[0].sessionId);
    transport.stop();
    started[0]();
    await launch;

    expect(backend.stop).toHaveBeenCalledOnce();
    expect(statuses).toEqual(["starting", "stopped"]);
    expect(transport.isCurrent(sessions[0].sessionId)).toBe(false);
  });
});
