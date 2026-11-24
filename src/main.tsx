import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { SMUFL } from "./engine/render/smufl";
import "./ui/styles/index.css";
import { applyE2eTestMode, applyVisualTestModeMarker } from "./test/testMode";

applyVisualTestModeMarker();
void applyE2eTestMode();

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

async function loadMusicFont(): Promise<boolean> {
  let timer: number | undefined;
  try {
    return await Promise.race([
      document.fonts.load("32px Bravura", SMUFL.gClef + SMUFL.restQuarter)
        .then((faces) => faces.some(({ status }) => status === "loaded")),
      new Promise<boolean>((resolve) => { timer = window.setTimeout(() => resolve(false), 3000); })
    ]);
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

void loadMusicFont().then((fontReady) => root.render(
  <React.StrictMode>
    {fontReady ? null : <p className="musicFontWarning" role="status">악보 글꼴을 불러오지 못했습니다.</p>}
    <App />
  </React.StrictMode>
));
