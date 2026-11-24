import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function OverlayPortal({ children }: { children: ReactNode }) {
  const [host] = useState(() => {
    const existing = document.getElementById("editor-overlays");
    if (existing) return existing;
    const node = document.createElement("div");
    node.id = "editor-overlays";
    document.body.appendChild(node);
    return node;
  });
  return createPortal(children, host);
}

export function AnchoredPopover({ anchor, onDismiss, className, children, id }: {
  anchor: RefObject<HTMLElement>;
  onDismiss: () => void;
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  useLayoutEffect(() => {
    const panel = ref.current;
    const trigger = anchor.current;
    if (!panel || !trigger) return;
    function place() {
      if (!panel || !trigger) return;
      const box = trigger.getBoundingClientRect();
      const left = Math.max(8, Math.min(box.left, innerWidth - panel.offsetWidth - 8));
      const underneath = box.bottom + 4;
      const top = underneath + panel.offsetHeight <= innerHeight - 8
        ? underneath : Math.max(8, box.top - panel.offsetHeight - 4);
      Object.assign(panel.style, { left: left + "px", top: top + "px" });
    }
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !panel?.contains(event.target) && !trigger?.contains(event.target)) dismiss.current();
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        dismiss.current();
        trigger?.focus();
      }
    }
    place();
    const observer = new ResizeObserver(place);
    observer.observe(panel);
    observer.observe(trigger);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    document.addEventListener("pointerdown", outside);
    panel.addEventListener("keydown", escape);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      document.removeEventListener("pointerdown", outside);
      panel.removeEventListener("keydown", escape);
    };
  }, [anchor]);
  return <OverlayPortal><div ref={ref} id={id} className={className} data-anchored-popover
    style={{ position: "fixed", right: "auto", bottom: "auto", maxWidth: "calc(100vw - 16px)", maxHeight: "calc(100dvh - 16px)", overflow: "auto", zIndex: 990 }}>{children}</div></OverlayPortal>;
}
