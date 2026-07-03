import { useMemo, useState } from "react";
import { ensureDemoCommandsRegistered } from "./commands/demoCommands";
import { executeCommand, getAllCommands } from "./commands/registry";
import { layoutScore } from "./engine/layout/layoutScore";
import { SvgRenderer } from "./engine/render/SvgRenderer";
import { createDemoScore } from "./model/demoScore";
import { usePlaybackStore } from "./store/playbackStore";
import { usePreferencesStore } from "./store/preferencesStore";
import { useViewStore } from "./store/viewStore";

interface DemoCommandState {
  lastMessage: string;
}

function App() {
  ensureDemoCommandsRegistered();

  const zoom = useViewStore((state) => state.zoom);
  const playbackStatus = usePlaybackStore((state) => state.status);
  const platform = usePreferencesStore((state) => state.platform);
  const [lastMessage, setLastMessage] = useState("No command executed yet.");

  const demoScore = useMemo(() => createDemoScore(), []);
  const scene = useMemo(() => layoutScore(demoScore), [demoScore]);
  const commands = useMemo(() => getAllCommands<DemoCommandState>(), []);

  function runAboutCommand() {
    const commandState: DemoCommandState = { lastMessage };
    executeCommand("app.about", commandState);
    setLastMessage(commandState.lastMessage);
  }

  return (
    <main className="appShell">
      <section className="workspace">
        <p className="eyebrow">SVG engraving pipeline</p>
        <h1>Guitar Pro Clone - Phase 2a</h1>
        <div className="statusGrid" aria-label="Phase 2a state summary">
          <span>
            <strong>Tracks</strong>
            {demoScore.tracks.length}
          </span>
          <span>
            <strong>Zoom</strong>
            {zoom}%
          </span>
          <span>
            <strong>Playback</strong>
            {playbackStatus}
          </span>
          <span>
            <strong>Platform</strong>
            {platform}
          </span>
        </div>
        <div className="scoreViewport">
          <SvgRenderer scene={scene} />
        </div>
      </section>

      <aside className="debugPanel" aria-label="Registered commands">
        <div className="panelHeader">
          <h2>Registered Commands</h2>
          <button type="button" onClick={runAboutCommand}>
            Run app.about
          </button>
        </div>
        <p className="commandMessage">{lastMessage}</p>
        <ul className="commandList">
          {commands.map((command) => (
            <li key={command.id}>
              <span>
                <strong>{command.label}</strong>
                <small>{command.id}</small>
              </span>
              <em>{command.category}</em>
            </li>
          ))}
        </ul>
      </aside>
    </main>
  );
}

export default App;
