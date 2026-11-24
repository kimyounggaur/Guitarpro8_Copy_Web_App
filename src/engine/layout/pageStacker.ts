import type { PageMetrics } from "../../model/stylesheet";
import type { BoundingBox, ScenePrimitive } from "./sceneGraph";

const MINIMUM_SCALE = 0.6;
// Score paths are generated as absolute point pairs, including the control points.
const coordinatePattern = /-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/gi;

export interface MeasuredSystem {
  primitives: ScenePrimitive[];
  bounds: BoundingBox;
}

export interface StackedPage {
  index: number;
  width: number;
  height: number;
  primitives: ScenePrimitive[];
}

export function measureSystem(primitives: ScenePrimitive[], minHeight: number): MeasuredSystem {
  let top = 0;
  let bottom = minHeight;
  let left = 0;
  let right = 0;
  for (const primitive of primitives) {
    const bounds = primitiveBounds(primitive);
    top = Math.min(top, bounds.y);
    bottom = Math.max(bottom, bounds.y + bounds.height);
    left = Math.min(left, bounds.x);
    right = Math.max(right, bounds.x + bounds.width);
  }
  return { primitives, bounds: { x: left, y: top, width: right - left, height: bottom - top } };
}

export function stackPages(systems: MeasuredSystem[], metrics: PageMetrics): StackedPage[] {
  const pages: StackedPage[] = [];
  let primitives: ScenePrimitive[] = [];
  const top = metrics.marginTop + metrics.headerHeight;
  const bottom = metrics.pageHeight - metrics.marginBottom;
  const space = Math.max(1, bottom - top);
  let y = top;

  for (const [index, system] of systems.entries()) {
    const height = system.bounds.height;
    const scale = metrics.continuous || height <= space ? 1 : Math.max(MINIMUM_SCALE, space / height);
    const effectiveHeight = height * scale;

    if (!metrics.continuous && primitives.length > 0 && y + effectiveHeight > bottom + 0.01) {
      pages.push({ index: pages.length, width: metrics.pageWidth, height: metrics.pageHeight, primitives });
      primitives = [];
      y = top;
    }

    const originY = y - system.bounds.y * scale;
    primitives.push(...system.primitives.map((primitive) => placePrimitive(primitive, metrics.marginLeft, originY, scale)));
    if (scale < 1) {
      primitives.push({
        id: `system-${index}-scale`,
        type: "text",
        x: metrics.pageWidth - metrics.marginRight,
        y: y - 3,
        fontSize: 10,
        anchor: "end",
        fill: "#634593",
        text: effectiveHeight > space + 0.01
          ? "System exceeds the page. Use a track view for more space."
          : `System shown at ${Math.round(scale * 100)}%.`
      });
    }
    y += effectiveHeight + metrics.systemGap;
  }

  if (systems.length > 0) {
    const height = metrics.continuous
      ? Math.max(metrics.pageHeight, y - metrics.systemGap + metrics.marginBottom)
      : metrics.pageHeight;
    pages.push({ index: pages.length, width: metrics.pageWidth, height, primitives });
  }
  return pages;
}

export function primitiveBounds(primitive: ScenePrimitive): BoundingBox {
  const bounds = geometryBounds(primitive);
  const hit = primitive.hit?.bbox;
  if (!hit) {
    return bounds;
  }

  const x = Math.min(bounds.x, hit.x);
  const y = Math.min(bounds.y, hit.y);
  return {
    x,
    y,
    width: Math.max(bounds.x + bounds.width, hit.x + hit.width) - x,
    height: Math.max(bounds.y + bounds.height, hit.y + hit.height) - y
  };
}

function geometryBounds(primitive: ScenePrimitive): BoundingBox {
  switch (primitive.type) {
    case "line":
      return boxFromPoints([primitive.x1, primitive.x2], [primitive.y1, primitive.y2], primitive.strokeWidth / 2);
    case "text": {
      const width = [...primitive.text].length * primitive.fontSize * 0.6;
      const anchor = primitive.anchor === "middle" ? 0.5 : primitive.anchor === "end" ? 1 : 0;
      return { x: primitive.x - width * anchor, y: primitive.y - primitive.fontSize, width, height: primitive.fontSize * 1.2 };
    }
    case "rect":
      return { x: primitive.x, y: primitive.y, width: primitive.width, height: primitive.height };
    case "ellipse":
      return { x: primitive.cx - primitive.rx, y: primitive.cy - primitive.ry, width: primitive.rx * 2, height: primitive.ry * 2 };
    case "path": {
      const values = (primitive.d.match(coordinatePattern) ?? []).map(Number);
      if (values.length === 0) {
        return { x: 0, y: 0, width: 0, height: 0 };
      }
      return boxFromPoints(
        values.filter((_, index) => index % 2 === 0),
        values.filter((_, index) => index % 2 === 1),
        (primitive.strokeWidth ?? 0) / 2
      );
    }
  }
}

function boxFromPoints(xs: number[], ys: number[], padding: number): BoundingBox {
  const x = Math.min(...xs) - padding;
  const y = Math.min(...ys) - padding;
  return { x, y, width: Math.max(...xs) + padding - x, height: Math.max(...ys) + padding - y };
}

function placePrimitive(primitive: ScenePrimitive, left: number, top: number, scale: number): ScenePrimitive {
  const x = (value: number) => left + value * scale;
  const y = (value: number) => top + value * scale;
  const size = (value: number | undefined) => value === undefined ? undefined : value * scale;
  const hit = primitive.hit && {
    ...primitive.hit,
    bbox: {
      x: x(primitive.hit.bbox.x),
      y: y(primitive.hit.bbox.y),
      width: primitive.hit.bbox.width * scale,
      height: primitive.hit.bbox.height * scale
    }
  };

  switch (primitive.type) {
    case "line":
      return { ...primitive, hit, x1: x(primitive.x1), y1: y(primitive.y1), x2: x(primitive.x2), y2: y(primitive.y2), strokeWidth: primitive.strokeWidth * scale };
    case "text":
      return { ...primitive, hit, x: x(primitive.x), y: y(primitive.y), fontSize: primitive.fontSize * scale };
    case "rect":
      return { ...primitive, hit, x: x(primitive.x), y: y(primitive.y), width: primitive.width * scale, height: primitive.height * scale, radius: size(primitive.radius), strokeWidth: size(primitive.strokeWidth) };
    case "ellipse":
      return { ...primitive, hit, cx: x(primitive.cx), cy: y(primitive.cy), rx: primitive.rx * scale, ry: primitive.ry * scale, strokeWidth: size(primitive.strokeWidth) };
    case "path": {
      let coordinate = 0;
      const d = primitive.d.replace(coordinatePattern, (value) => String(
        coordinate++ % 2 === 0 ? x(Number(value)) : y(Number(value))
      ));
      return { ...primitive, hit, d, strokeWidth: size(primitive.strokeWidth) };
    }
  }
}
