import { useRef } from "react";

interface DockSplitterProps {
  label: string;
  controls: string;
  value: number;
  min: number;
  max: number;
  reverse?: boolean;
  horizontal?: boolean;
  onResize: (size: number) => void;
  onCommit: () => void;
  onReset: () => void;
}

export function DockSplitter({
  label, controls, value, min, max, reverse = false, horizontal = false, onResize, onCommit, onReset
}: DockSplitterProps) {
  const drag = useRef<{ id: number; coordinate: number; size: number } | null>(null);
  const clamp = (size: number) => Math.min(max, Math.max(min, size));
  return (
    <div
      className={`dockSplitter ${horizontal ? "dockSplitterHorizontal" : ""}`}
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-controls={controls}
      aria-orientation={horizontal ? "horizontal" : "vertical"}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.focus({ preventScroll: true });
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = {
          id: event.pointerId,
          coordinate: horizontal ? event.clientY : event.clientX,
          size: value
        };
        event.currentTarget.dataset.dragging = "true";
      }}
      onPointerMove={(event) => {
        const start = drag.current;
        if (event.pointerId !== start?.id) return;
        const delta = (horizontal ? event.clientY : event.clientX) - start.coordinate;
        onResize(clamp(start.size + (reverse ? -delta : delta)));
      }}
      onLostPointerCapture={(event) => {
        if (event.pointerId !== drag.current?.id) return;
        drag.current = null;
        delete event.currentTarget.dataset.dragging;
        onCommit();
      }}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        const increase = horizontal ? "ArrowDown" : "ArrowRight";
        const decrease = horizontal ? "ArrowUp" : "ArrowLeft";
        if (![increase, decrease, "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const adjustment = (event.shiftKey ? 24 : 8) * (reverse ? -1 : 1);
        const next = event.key === "Home" ? min : event.key === "End" ? max : value + (event.key === increase ? adjustment : -adjustment);
        onResize(clamp(next));
        onCommit();
      }}
    />
  );
}
