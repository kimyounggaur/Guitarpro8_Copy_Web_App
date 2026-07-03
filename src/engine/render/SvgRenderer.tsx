import type { SceneGraph, ScenePrimitive } from "../layout/sceneGraph";

interface SvgRendererProps {
  scene: SceneGraph;
}

export function SvgRenderer({ scene }: SvgRendererProps) {
  return (
    <div className="scorePages" aria-label="Rendered score">
      {scene.pages.map((page) => (
        <svg
          key={page.id}
          className="scorePage"
          width={page.width}
          height={page.height}
          viewBox={`0 0 ${page.width} ${page.height}`}
          role="img"
          aria-label={page.id}
        >
          {page.primitives.map((primitive, index) => renderPrimitive(primitive, index))}
        </svg>
      ))}
    </div>
  );
}

function renderPrimitive(primitive: ScenePrimitive, index: number) {
  const key = `${primitive.id}-${index}`;
  const hitProps = primitive.hit
    ? {
        "data-hit-kind": primitive.hit.kind,
        "data-hit-ref": JSON.stringify(primitive.hit.ref)
      }
    : {};

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
          pointerEvents={primitive.pointerEvents}
          {...hitProps}
        />
      );
  }
}
