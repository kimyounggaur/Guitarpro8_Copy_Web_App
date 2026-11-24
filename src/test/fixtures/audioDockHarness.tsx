import { createRoot } from "react-dom/client";
import { compilePlayback } from "../../engine/audio/compile";
import { unrollScore } from "../../engine/unroll/unrollScore";
import { useDocumentStore } from "../../store/documentStore";
import { AudioTrackDock } from "../../ui/audio-track/AudioTrackDock";

export function mountAudioDockFixture() {
  const host = document.createElement("aside");
  host.dataset.testid = "audio-dock-fixture";
  host.style.cssText = "position:fixed;inset:30px 30px auto;z-index:99999";
  document.body.append(host);
  const score = useDocumentStore.getState().score;
  const compilation = compilePlayback(score, unrollScore(score));
  const root = createRoot(host);
  root.render(<AudioTrackDock compilation={compilation} onSeek={sec => { host.dataset.seek = String(sec); }} />);
}
