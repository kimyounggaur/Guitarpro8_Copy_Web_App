import { useId, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { useOverlayStore, type OverlayKind } from "../../store/overlayStore";
import { useDialogFocus } from "./useDialogFocus";
import { OverlayPortal } from "./OverlayPortal";
import "../styles/remaster-overlays.css";

type Bounds = { x: number; y: number; width: number; height: number };

function clampWindow(box: Bounds): Bounds {
  const width = Math.min(Math.max(420, box.width), Math.max(1, innerWidth - 16));
  const height = Math.min(Math.max(220, box.height), Math.max(1, innerHeight - 16));
  return { width, height, x: Math.max(8, Math.min(box.x, innerWidth - 8 - width)),
    y: Math.max(8, Math.min(box.y, innerHeight - 8 - height)) };
}

function loadBounds(id: string): Bounds {
  try {
    const stored = JSON.parse(localStorage.getItem("tabscore.window." + id) ?? "null");
    if (stored && ["x","y","width","height"].every((key) => Number.isFinite(stored[key]))) return clampWindow(stored);
  } catch { /* Session-only layout when persistent settings are unavailable. */ }
  const width = Math.min(850, innerWidth * 0.72);
  const height = Math.min(495, innerHeight * 0.63);
  return clampWindow({ width, height, x: (innerWidth - width) / 2, y: (innerHeight - height) / 2 });
}

function rememberBounds(id: string, box: Bounds) {
  try { localStorage.setItem("tabscore.window." + id, JSON.stringify(box)); } catch { /* Optional preference. */ }
}

interface EditorWindowProps {
  kind: OverlayKind;
  id: string;
  title: string;
  description: string;
  regionLabel: string;
  closeLabel: string;
  modal: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function EditorWindow(props: EditorWindowProps) {
  return <OverlayPortal><WindowFrame key={props.id} {...props} /></OverlayPortal>;
}

function WindowFrame({ id, title, description, regionLabel, closeLabel, modal, kind, onClose, children }: EditorWindowProps) {
  const [bounds, setBounds] = useState(() => loadBounds(id));
  const current = useRef(bounds);
  const gesture = useRef<{ mode: "move" | "resize"; x: number; y: number; start: Bounds } | null>(null);
  const element = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const z = useOverlayStore((state) => state.stack.findIndex((entry) => entry.kind === kind));
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const windowElement = element.current;
    const dismiss = () => close.current();
    windowElement?.addEventListener("editor-window-dismiss", dismiss);
    return () => windowElement?.removeEventListener("editor-window-dismiss", dismiss);
  }, []);
  useDialogFocus(element, modal, "native");
  useLayoutEffect(() => {
    const previous = document.activeElement;
    if (!modal) element.current?.focus({ preventScroll: true });
    const resized = () => update(clampWindow(current.current));
    window.addEventListener("resize", resized);
    return () => {
      window.removeEventListener("resize", resized);
      if (!modal && previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [modal]);

  function update(next: Bounds) {
    current.current = next;
    setBounds(next);
  }
  function start(event: PointerEvent<HTMLElement>, mode: "move" | "resize") {
    if (event.button !== 0 || (mode === "move" && (event.target as HTMLElement).closest("button"))) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { mode, x: event.clientX, y: event.clientY, start: current.current };
  }
  function move(event: PointerEvent<HTMLElement>) {
    const drag = gesture.current;
    if (!drag) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const next = drag.mode === "move" ? { ...drag.start, x: drag.start.x + dx, y: drag.start.y + dy }
      : { ...drag.start, width: drag.start.width + dx, height: drag.start.height + dy };
    update(clampWindow(next));
  }
  function end() {
    if (gesture.current) rememberBounds(id, current.current);
    gesture.current = null;
  }
  return <dialog ref={element} open={modal ? undefined : true} aria-modal={modal || undefined} tabIndex={-1}
    data-editor-window={kind} data-window-id={id} className="remasterWindow" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={(event) => { if (event.currentTarget === event.target) { event.preventDefault(); onClose(); } }}
    onPointerDownCapture={() => useOverlayStore.getState().activate(kind)}
    onFocusCapture={() => useOverlayStore.getState().activate(kind)}
    style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height, zIndex: 850 + z }}>
    <div role="region" aria-label={regionLabel} className="remasterWindowRegion">
    <div className="remasterWindowTitle" onPointerDown={(event) => start(event, "move")} onPointerMove={move} onPointerUp={end} onLostPointerCapture={end}>
      <span aria-hidden="true" className="windowMark">▦</span><strong id={titleId}>{title}</strong>
      <button type="button" aria-label={closeLabel} title={closeLabel} onClick={onClose}>×</button>
    </div>
    <span className="remasterSrOnly" id={descriptionId}>{description}</span>
    {children}
    </div>
    <button type="button" className="windowResizeHandle" aria-label={'Resize ' + title} title="Resize window · Arrow keys"
      onPointerDown={(event) => start(event, "resize")} onPointerMove={move} onPointerUp={end} onLostPointerCapture={end}
      onKeyDown={(event) => {
        const delta = ({ ArrowLeft: [-16,0], ArrowRight: [16,0], ArrowUp: [0,-16], ArrowDown: [0,16] } as Record<string, number[]>)[event.key];
        if (!delta) return;
        event.preventDefault();
        const box = current.current;
        update(clampWindow({ ...box, width: box.width + delta[0], height: box.height + delta[1] }));
        rememberBounds(id, current.current);
      }} />
  </dialog>;
}
