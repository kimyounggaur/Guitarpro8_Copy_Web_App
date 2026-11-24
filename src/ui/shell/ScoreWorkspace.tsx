import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useViewStore } from "../../store/viewStore";

interface ScrollPoint { left: number; top: number }
const positions = new Map<string, ScrollPoint>();
const SCROLL_KEY = "tabscore.workspace-scroll.v1";
try {
  const saved = JSON.parse(sessionStorage.getItem(SCROLL_KEY) ?? "{}");
  for (const [id, value] of Object.entries(saved)) {
    if (value && typeof value === "object" && "left" in value && "top" in value &&
      typeof value.left === "number" && typeof value.top === "number" && Number.isFinite(value.left) && Number.isFinite(value.top)) {
      positions.set(id, { left: value.left, top: value.top });
    }
  }
} catch {
  // In-memory locations continue to work for this session.
}

interface ScoreWorkspaceProps {
  children: ReactNode;
  documentId: string;
  onZoomChange: (zoom: number) => void;
}

export function ScoreWorkspace({ children, documentId, onZoomChange }: ScoreWorkspaceProps) {
  const shell = useRef<HTMLElement>(null);
  const anchor = useRef<ScrollPoint | null>(null);
  const viewport = () => shell.current?.querySelector<HTMLElement>(".scoreViewport") ?? null;
  const zoom = useViewStore((state) => state.zoom);
  const requestZoom = useRef(onZoomChange);
  useLayoutEffect(() => { requestZoom.current = onZoomChange; }, [onZoomChange]);

  useLayoutEffect(() => {
    const surface = viewport();
    if (!surface) return;
    anchor.current = null;
    const saved = positions.get(documentId);
    if (saved) surface.scrollTo(saved);
    else surface.scrollTo({ left: 0, top: 0 });
    const savePosition = () => {
      positions.delete(documentId);
      positions.set(documentId, { left: surface.scrollLeft, top: surface.scrollTop });
      if (positions.size > 32) positions.delete(positions.keys().next().value ?? "");
      try {
        sessionStorage.setItem(SCROLL_KEY, JSON.stringify(Object.fromEntries(positions)));
      } catch {
        // In-memory positions are sufficient when storage is restricted.
      }
    };
    window.addEventListener("pagehide", savePosition);
    return () => {
      window.removeEventListener("pagehide", savePosition);
      savePosition();
    };
  }, [documentId]);

  useLayoutEffect(() => {
    const next = anchor.current;
    if (next) viewport()?.scrollTo(next);
    anchor.current = null;
  }, [zoom]);

  useEffect(() => {
    const surface = viewport();
    if (!surface) return;
    let previousZoom = useViewStore.getState().zoom;
    const unsubscribe = useViewStore.subscribe((state) => {
      if (state.zoom === previousZoom) return;
      const factor = state.zoom / previousZoom;
      const x = surface.clientWidth / 2;
      const y = surface.clientHeight / 2;
      anchor.current = { left: (surface.scrollLeft + x) * factor - x, top: (surface.scrollTop + y) * factor - y };
      previousZoom = state.zoom;
    });
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const current = useViewStore.getState().zoom;
      if (event.deltaY !== 0) requestZoom.current(current + (event.deltaY < 0 ? 5 : -5));
    };
    surface.addEventListener("wheel", wheel, { passive: false });
    return () => {
      unsubscribe();
      surface.removeEventListener("wheel", wheel);
    };
  }, [documentId]);

  function fit(mode: "width" | "page") {
    const surface = viewport();
    const page = surface?.querySelector<HTMLElement>(".scorePageSlot") ?? surface?.querySelector<SVGSVGElement>("svg.scorePage");
    if (!surface || !page) return;
    const bounds = page.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const padding = getComputedStyle(surface);
    const widthRatio = (surface.clientWidth - parseFloat(padding.paddingLeft) - parseFloat(padding.paddingRight)) / bounds.width;
    const heightRatio = (surface.clientHeight - parseFloat(padding.paddingTop) - parseFloat(padding.paddingBottom)) / bounds.height;
    const next = Math.floor(zoom * (mode === "width" ? widthRatio : Math.min(widthRatio, heightRatio)) / 5) * 5;
    onZoomChange(next);
  }

  return (
    <section ref={shell} className="workspacePanel remasterWorkspace" data-testid="workspace-panel">
      <div className="workspaceCanvas">{children}</div>
      <div className="workspaceControls">
        <span className="workspaceZoom">{zoom}%</span>
        <button type="button" onClick={() => fit("width")}>Fit width</button>
        <button type="button" onClick={() => fit("page")}>Fit page</button>
      </div>
    </section>
  );
}
