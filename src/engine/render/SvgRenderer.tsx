import { memo, useEffect, useMemo, useRef, useState, type ReactElement, type RefObject } from "react";
import type { SceneGraph, ScenePage, ScenePrimitive } from "../layout/sceneGraph";
import type { DisplayMode } from "../../model/types";
import { editorOverlayPrimitives, type EditorOverlayState } from "../editing/overlays";

interface SvgRendererProps {
  scene: SceneGraph;
  displayMode: DisplayMode;
  zoom: number;
  overlays?: EditorOverlayState;
  editorViewport?: RefObject<HTMLDivElement>;
}

export function SvgRenderer({ scene, displayMode, zoom, overlays, editorViewport }: SvgRendererProps) {
  const pagesRef = useRef<HTMLDivElement>(null);
  const renderedPages = useViewportPages(pagesRef, editorViewport, scene.pages.length);
  const ranges = useMemo(() => scene.pages.map(pageBarRange), [scene.pages]);

  return (
    <div
      ref={pagesRef}
      className={`scorePages display-${displayMode}`}
      aria-label="Rendered score"
      data-active-voice={overlays?.cursor.voiceIndex}
      data-highlight-voice={overlays?.multiVoiceEdit ? overlays.cursor.voiceIndex : undefined}
    >
      {scene.pages.map((page, index) => {
        const range = ranges[index];
        const pageOverlays = overlays && includesOverlay(range, overlays) ? overlays : undefined;
        return renderedPages === null ? (
          <SvgPage key={page.id} page={page} zoom={zoom} overlays={pageOverlays} />
        ) : (
          <div
            key={page.id}
            className="scorePageSlot"
            data-page-slot={index}
            data-bar-start={range.start}
            data-bar-end={range.end}
            data-mounted={renderedPages.has(index)}
            style={{
              width: page.width * zoom / 100,
              height: page.height * zoom / 100
            }}
          >
            {renderedPages.has(index) ? <SvgPage page={page} zoom={zoom} overlays={pageOverlays} /> : null}
          </div>
        );
      })}
    </div>
  );
}

const SvgPage = memo(function SvgPage({
  page, zoom, overlays
}: {
  page: ScenePage;
  zoom: number;
  overlays?: EditorOverlayState;
}) {
  return (
    <svg
      className="scorePage"
      width={page.width}
      height={page.height}
      viewBox={`0 0 ${page.width} ${page.height}`}
      style={{ width: `${page.width * zoom / 100}px`, aspectRatio: `${page.width} / ${page.height}` }}
      role="img"
      aria-label={page.id}
    >
      <BasePrimitives primitives={page.primitives} />
      {overlays && (
        <g data-score-overlay="" pointerEvents="none">
          {editorOverlayPrimitives(page.primitives, overlays).map(renderPrimitive)}
        </g>
      )}
    </svg>
  );
});

const baseElements = new WeakMap<ScenePrimitive, { key: string; element: ReactElement }>();
const BasePrimitives = memo(function BasePrimitives({ primitives }: { primitives: ScenePrimitive[] }) {
  const appearances = new Map<string, number>();
  const elements = primitives.map((primitive) => {
    const appearance = appearances.get(primitive.id) ?? 0;
    appearances.set(primitive.id, appearance + 1);
    const key = `${primitive.id}-${appearance}`;
    const existing = baseElements.get(primitive);
    if (existing?.key === key) return existing.element;

    const element = renderPrimitive(primitive, appearance);
    baseElements.set(primitive, { key, element });
    return element;
  });
  return <g data-score-base="">{elements}</g>;
});

const pageRanges = new WeakMap<ScenePage, { start?: number; end?: number }>();
function pageBarRange(page: ScenePage): { start?: number; end?: number } {
  const known = pageRanges.get(page);
  if (known) return known;
  let start = Infinity;
  let end = -Infinity;
  for (const { hit } of page.primitives) {
    const bar = hit?.ref.barIndex;
    if (bar === undefined) continue;
    start = Math.min(start, bar);
    end = Math.max(end, bar);
  }
  const range = start === Infinity ? {} : { start, end };
  pageRanges.set(page, range);
  return range;
}

function includesOverlay(
  { start, end }: ReturnType<typeof pageBarRange>,
  { cursor, selection, playbackBarIndex }: EditorOverlayState
): boolean {
  if (start === undefined || end === undefined) return false;
  if (cursor.barIndex >= start && cursor.barIndex <= end) return true;
  if (playbackBarIndex !== null && playbackBarIndex >= start && playbackBarIndex <= end) return true;
  if (!selection) return false;
  const selectionStart = Math.min(selection.anchor.barIndex, selection.head.barIndex);
  const selectionEnd = Math.max(selection.anchor.barIndex, selection.head.barIndex);
  return selectionStart <= end && selectionEnd >= start;
}

function useViewportPages(
  pagesRef: RefObject<HTMLDivElement>,
  editorViewport: RefObject<HTMLDivElement> | undefined,
  pageCount: number
): Set<number> | null {
  const canObserve = !!editorViewport && typeof IntersectionObserver !== "undefined";
  const previous = useRef<Set<number>>(new Set([0, 1]));
  const [mountedPages, setMountedPages] = useState(previous.current);

  useEffect(() => {
    const root = editorViewport?.current;
    const container = pagesRef.current;
    if (!canObserve || !root || !container || pageCount <= 2) return;

    const visible = new Set<number>();
    const observer = new IntersectionObserver((entries) => {
      for (const { target, isIntersecting } of entries) {
        const index = Number((target as HTMLElement).dataset.pageSlot);
        if (isIntersecting) visible.add(index);
        else visible.delete(index);
      }
      if (visible.size === 0) return;

      const next = new Set<number>();
      for (const index of visible) {
        for (let neighbor = Math.max(0, index - 1); neighbor <= Math.min(pageCount - 1, index + 1); neighbor++) {
          next.add(neighbor);
        }
      }
      if (next.size === previous.current.size && [...next].every((index) => previous.current.has(index))) return;
      previous.current = next;
      setMountedPages(next);
    }, { root });

    container.querySelectorAll(".scorePageSlot").forEach((slot) => observer.observe(slot));
    return () => observer.disconnect();
  }, [canObserve, editorViewport, pagesRef, pageCount]);

  return canObserve && pageCount > 2 ? mountedPages : null;
}

function renderPrimitive(primitive: ScenePrimitive, index: number) {
  const key = `${primitive.id}-${index}`;
  const hitProps = {
    "data-hit-kind": primitive.hit?.kind,
    "data-hit-ref": primitive.hit ? JSON.stringify(primitive.hit.ref) : undefined,
    "data-score-voice": primitive.voiceIndex ?? primitive.hit?.ref.voiceIndex
  };

  switch (primitive.type) {
    case "line":
      return (
        <line
          key={key}
          id={primitive.id}
          x1={primitive.x1}
          y1={primitive.y1}
          x2={primitive.x2}
          y2={primitive.y2}
          stroke={primitive.stroke}
          strokeWidth={primitive.strokeWidth}
          strokeLinecap={primitive.strokeLinecap}
          strokeDasharray={primitive.strokeDasharray}
          pointerEvents={primitive.pointerEvents}
          {...hitProps}
        />
      );
    case "text":
      return (
        <text
          key={key}
          id={primitive.id}
          x={primitive.x}
          y={primitive.y}
          fill={primitive.fill}
          fontSize={primitive.fontSize}
          fontFamily={primitive.fontFamily}
          textAnchor={primitive.anchor}
          pointerEvents={primitive.pointerEvents}
          {...hitProps}
        >
          {primitive.text}
        </text>
      );
    case "rect":
      return (
        <rect
          key={key}
          id={primitive.id}
          x={primitive.x}
          y={primitive.y}
          width={primitive.width}
          height={primitive.height}
          rx={primitive.radius}
          fill={primitive.fill}
          stroke={primitive.stroke}
          strokeWidth={primitive.strokeWidth}
          pointerEvents={primitive.pointerEvents}
          {...hitProps}
        />
      );
    case "ellipse":
      return (
        <ellipse
          key={key}
          id={primitive.id}
          cx={primitive.cx}
          cy={primitive.cy}
          rx={primitive.rx}
          ry={primitive.ry}
          fill={primitive.fill}
          stroke={primitive.stroke}
          strokeWidth={primitive.strokeWidth}
          pointerEvents={primitive.pointerEvents}
          {...hitProps}
        />
      );
    case "path":
      return (
        <path
          key={key}
          id={primitive.id}
          d={primitive.d}
          fill={primitive.fill}
          stroke={primitive.stroke}
          strokeWidth={primitive.strokeWidth}
          strokeLinecap={primitive.strokeLinecap}
          strokeLinejoin={primitive.strokeLinejoin}
          strokeDasharray={primitive.strokeDasharray}
          pointerEvents={primitive.pointerEvents}
          {...hitProps}
        />
      );
  }
}
