import { useEffect, useRef, type RefObject } from "react";

const VIEWPORT_MARGIN = 0.15;
const MANUAL_SCROLL_PAUSE_MS = 3000;

export function useScoreFollow(
  viewportRef: RefObject<HTMLDivElement>,
  targetSelector: string,
  locationKey: string,
  ready: boolean
): void {
  const suspendedUntil = useRef(0);
  const programmaticUntil = useRef(0);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !ready) return;
    const pause = () => {
      suspendedUntil.current = performance.now() + MANUAL_SCROLL_PAUSE_MS;
      programmaticUntil.current = 0;
    };
    const onScroll = () => {
      if (performance.now() >= programmaticUntil.current) pause();
    };
    const onPointerDown = (event: PointerEvent) => {
      const bounds = viewport.getBoundingClientRect();
      if (event.clientX >= bounds.left + viewport.clientWidth || event.clientY >= bounds.top + viewport.clientHeight) pause();
    };
    viewport.addEventListener("scroll", onScroll, { passive: true });
    viewport.addEventListener("wheel", pause, { passive: true });
    viewport.addEventListener("touchstart", pause, { passive: true });
    viewport.addEventListener("pointerdown", onPointerDown);
    return () => {
      viewport.removeEventListener("scroll", onScroll);
      viewport.removeEventListener("wheel", pause);
      viewport.removeEventListener("touchstart", pause);
      viewport.removeEventListener("pointerdown", onPointerDown);
    };
  }, [ready, viewportRef]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !ready) return;
    const frame = requestAnimationFrame(() => {
      if (performance.now() < suspendedUntil.current) return;
      const target = viewport.querySelector(targetSelector);
      if (!target) return;

      const view = viewport.getBoundingClientRect();
      const visibleWidth = viewport.clientWidth;
      const visibleHeight = viewport.clientHeight;
      const bounds = target.getBoundingClientRect();
      const left = viewport.scrollWidth > visibleWidth
        ? scrollDelta(bounds.left - view.left, bounds.width, visibleWidth)
        : 0;
      const top = viewport.scrollHeight > visibleHeight
        ? scrollDelta(bounds.top - view.top, bounds.height, visibleHeight)
        : 0;

      if (!left && !top) return;
      programmaticUntil.current = performance.now() + 1000;
      viewport.scrollBy({
        top,
        left,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [locationKey, targetSelector, viewportRef, ready]);
}

function scrollDelta(start: number, contentSize: number, viewportSize: number): number {
  const margin = viewportSize * VIEWPORT_MARGIN;
  const end = start + contentSize;
  if (start < margin || end > viewportSize - margin) {
    return start + contentSize / 2 - viewportSize / 2;
  }
  return 0;
}
