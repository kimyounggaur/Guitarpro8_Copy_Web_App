import type { NoteRef } from "../../model/types";

export type HitKind =
  | "note"
  | "beat"
  | "bar"
  | "header"
  | "timeSig"
  | "keySig"
  | "clef"
  | "track";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HitMetadata {
  kind: HitKind;
  ref: Partial<NoteRef>;
  bbox: BoundingBox;
}

interface PrimitiveBase {
  id: string;
  hit?: HitMetadata;
}

export interface LinePrimitive extends PrimitiveBase {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  strokeWidth: number;
}

export interface TextPrimitive extends PrimitiveBase {
  type: "text";
  x: number;
  y: number;
  text: string;
  fill: string;
  fontSize: number;
  fontFamily?: string;
  anchor?: "start" | "middle" | "end";
}

export interface RectPrimitive extends PrimitiveBase {
  type: "rect";
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
  radius?: number;
}

export interface EllipsePrimitive extends PrimitiveBase {
  type: "ellipse";
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  fill: string;
  stroke?: string;
  strokeWidth?: number;
}

export type ScenePrimitive = LinePrimitive | TextPrimitive | RectPrimitive | EllipsePrimitive;

export interface ScenePage {
  id: string;
  width: number;
  height: number;
  primitives: ScenePrimitive[];
}

export interface SceneGraph {
  pages: ScenePage[];
}
