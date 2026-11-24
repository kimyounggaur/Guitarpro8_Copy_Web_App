import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { dockDefaults, dockLimits, useLayoutStore, type DockSize } from "../../store/layoutStore";
import { DockSplitter } from "./DockSplitter";

const CENTER_WIDTH = 420;
const CENTER_HEIGHT = 280;
const SPLITTER = 8;

interface DockLayoutProps {
  palette?: ReactNode;
  inspector?: ReactNode;
  workspace: ReactNode;
  global?: ReactNode;
  automation?: ReactNode;
  audio?: ReactNode;
}

export function EditorDockLayout({ palette, inspector, workspace, global, automation, audio }: DockLayoutProps) {
  const element = useRef<HTMLDivElement>(null);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
  const sizes = useLayoutStore((state) => state.sizes);
  const setDockSize = useLayoutStore((state) => state.setDockSize);
  const persist = useLayoutStore((state) => state.save);

  useEffect(() => {
    const root = element.current;
    if (!root) return;
    function measure() {
      if (root) {
        const { clientWidth: width, clientHeight: height } = root;
        setWindowSize((size) => size.width === width && size.height === height ? size : { width, height });
      }
    }
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(root);
    return () => observer?.disconnect();
  }, []);

  const showLeft = Boolean(palette);
  const showRight = Boolean(inspector);
  const width = windowSize.width || window.innerWidth;
  const height = windowSize.height || window.innerHeight;
  const horizontal = fitDocks(
    [showLeft ? sizes.left : 0, showRight ? sizes.right : 0],
    [showLeft ? dockLimits.left[0] : 0, showRight ? dockLimits.right[0] : 0],
    width - CENTER_WIDTH - SPLITTER * (Number(showLeft) + Number(showRight))
  );
  const candidates: Array<{ dock: "audio" | "automation" | "global"; label: string; id: string; content: ReactNode }> = [
    { dock: "audio", label: "Resize audio track", id: "editor-audio-dock", content: audio },
    { dock: "automation", label: "Resize automation", id: "editor-automation-dock", content: automation },
    { dock: "global", label: "Resize global view", id: "editor-global-dock", content: global }
  ];
  const verticalDocks = candidates.filter(({ content }) => Boolean(content));
  const verticalAvailable = height - CENTER_HEIGHT - SPLITTER * verticalDocks.length;
  const vertical = fitDocks(
    verticalDocks.map(({ dock }) => sizes[dock]),
    verticalDocks.map(({ dock }) => dockLimits[dock][0]),
    verticalAvailable
  );
  const style: CSSProperties = {
    gridTemplateRows: `minmax(0, 1fr) ${vertical.map((size) => `${SPLITTER}px ${size}px`).join(" ")}`
  };

  function separator(dock: DockSize, label: string, id: string, value: number, limit: number, horizontal = false) {
    const min = Math.min(value, dockLimits[dock][0]);
    return <DockSplitter
      label={label}
      controls={id}
      value={value}
      min={min}
      max={Math.max(value, Math.min(dockLimits[dock][1], limit))}
      horizontal={horizontal}
      reverse={dock !== "left"}
      onResize={(size) => setDockSize(dock, size)}
      onCommit={persist}
      onReset={() => { setDockSize(dock, dockDefaults[dock]); persist(); }}
    />;
  }

  return (
    <div ref={element} className="editorDockLayout" style={style}>
      <section className="gpMain resizableEditorMain" style={{
        gridTemplateColumns: `${showLeft ? `${horizontal[0]}px ${SPLITTER}px` : ""} minmax(0, 1fr) ${showRight ? `${SPLITTER}px ${horizontal[1]}px` : ""}`
      }}>
        {showLeft && <div id="editor-palette-dock" className="paletteDockSlot">{palette}</div>}
        {showLeft && separator("left", "Resize edition palette", "editor-palette-dock", horizontal[0], width - CENTER_WIDTH - horizontal[1] - SPLITTER * (showRight ? 2 : 1))}
        {workspace}
        {showRight && separator("right", "Resize inspector", "editor-inspector-dock", horizontal[1], width - CENTER_WIDTH - horizontal[0] - SPLITTER * (showLeft ? 2 : 1))}
        {showRight && <div id="editor-inspector-dock" className="inspectorDockSlot">{inspector}</div>}
      </section>
      {verticalDocks.flatMap(({ dock, label, id, content }, index) => [
        <div key={`${dock}-splitter`} className="horizontalSplitterSlot">
          {separator(dock, label, id, vertical[index], verticalAvailable - vertical.reduce((sum, size, position) => sum + (position === index ? 0 : size), 0), true)}
        </div>,
        <section key={dock} id={id} className={`bottomDock ${dock}Visible`} data-testid={dock === "global" || !global && dock === "automation" ? "bottom-dock" : undefined}>
          {content}
        </section>
      ])}
    </div>
  );
}

function fitDocks(wanted: number[], minima: number[], available: number): number[] {
  const total = wanted.reduce((sum, size) => sum + size, 0);
  if (total <= available) return wanted;
  const floor = minima.reduce((sum, size) => sum + size, 0);
  const remaining = Math.max(0, available);
  if (remaining <= floor) {
    return minima.map((size) => floor ? Math.floor(remaining * size / floor) : 0);
  }

  return wanted.map((size, index) =>
    minima[index] + Math.floor((size - minima[index]) * (remaining - floor) / (total - floor))
  );
}
