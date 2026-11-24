import { useEffect, useRef, useState } from "react";
import { t } from "../i18n/messages.en";

// Monitoring is opt-in and independent of score playback/recording.
export function useLineInput() {
  const generation = useRef(0);
  const device = useRef<{ context?: AudioContext; stream: MediaStream } | null>(null);
  const [state, setState] = useState<"idle" | "requesting" | "active">("idle");
  const [error, setError] = useState("");

  function release() {
    generation.current++;
    const current = device.current;
    device.current = null;
    current?.stream.getTracks().forEach((track) => track.stop());
    if (current?.context && current.context.state !== "closed")
      void current.context.close().catch(() => undefined);
  }
  useEffect(() => release, []);

  async function toggle() {
    setError("");
    if (state !== "idle") {
      release();
      setState("idle");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("toolbar.lineInUnavailable"));
      return;
    }
    const request = ++generation.current;
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      if (request !== generation.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      device.current = { stream };
      const context = new AudioContext();
      device.current.context = context;
      await context.resume();
      if (request !== generation.current) return;
      const gain = context.createGain();
      gain.gain.value = 0.15;
      context.createMediaStreamSource(stream).connect(gain).connect(context.destination);
      stream.getAudioTracks().forEach((track) =>
        track.addEventListener(
          "ended",
          () => {
            if (generation.current === request) {
              release();
              setState("idle");
            }
          },
          { once: true }
        )
      );
      setState("active");
    } catch (reason) {
      if (request !== generation.current) return;
      release();
      setState("idle");
      setError(
        reason instanceof DOMException && reason.name === "NotAllowedError"
          ? t("toolbar.lineInDenied")
          : t("toolbar.lineInUnavailable")
      );
    }
  }
  return { active: state !== "idle", toggle, error, dismissError: () => setError("") };
}
