import type { SceneGraph, ScenePage, ScenePrimitive } from "../engine/layout/sceneGraph";

export interface SvgExportOptions {
  transparentBackground?: boolean;
  gap?: number;
}

export function sceneToSvgDocument(scene: SceneGraph, options: SvgExportOptions = {}): string {
  const gap = options.gap ?? 24;
  const width = Math.max(...scene.pages.map((page) => page.width), 1);
  const height = scene.pages.reduce((sum, page, index) => sum + page.height + (index > 0 ? gap : 0), 0);
  let y = 0;
  const pages = scene.pages.map((page) => {
    const content = pageToSvgGroup(page, y, options);
    y += page.height + gap;
    return content;
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(width)}" height="${round(height)}" viewBox="0 0 ${round(width)} ${round(height)}">`,
    '  <title>GuitarPro8 Copy export</title>',
    ...pages,
    '</svg>',
    ''
  ].join("\n");
}

export function sceneFirstPageSvg(scene: SceneGraph, options: SvgExportOptions = {}): string {
  const first = scene.pages[0];

  if (!first) {
    return sceneToSvgDocument({ pages: [] }, options);
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(first.width)}" height="${round(first.height)}" viewBox="0 0 ${round(first.width)} ${round(first.height)}">`,
    ...pagePrimitives(first, options).map((primitive) => `  ${primitive}`),
    '</svg>',
    ''
  ].join("\n");
}

function pageToSvgGroup(page: ScenePage, y: number, options: SvgExportOptions): string {
  return [
    `  <g id="${escapeXml(page.id)}" transform="translate(0 ${round(y)})">`,
    ...pagePrimitives(page, options).map((primitive) => `    ${primitive}`),
    '  </g>'
  ].join("\n");
}

function pagePrimitives(page: ScenePage, options: SvgExportOptions): string[] {
  return page.primitives
    .filter((primitive) => !(options.transparentBackground && primitive.type === "rect" && primitive.id.endsWith("background")))
    .map(primitiveToSvg);
}

function primitiveToSvg(primitive: ScenePrimitive): string {
  switch (primitive.type) {
    case "line":
      return `<line id="${escapeXml(primitive.id)}" x1="${round(primitive.x1)}" y1="${round(primitive.y1)}" x2="${round(primitive.x2)}" y2="${round(primitive.y2)}" stroke="${escapeXml(primitive.stroke)}" stroke-width="${round(primitive.strokeWidth)}"${attr("stroke-linecap", primitive.strokeLinecap)}${attr("stroke-dasharray", primitive.strokeDasharray)} />`;
    case "text":
      return `<text id="${escapeXml(primitive.id)}" x="${round(primitive.x)}" y="${round(primitive.y)}" fill="${escapeXml(primitive.fill)}" font-size="${round(primitive.fontSize)}"${attr("font-family", primitive.fontFamily)}${attr("text-anchor", primitive.anchor)}>${escapeXml(primitive.text)}</text>`;
    case "rect":
      return `<rect id="${escapeXml(primitive.id)}" x="${round(primitive.x)}" y="${round(primitive.y)}" width="${round(primitive.width)}" height="${round(primitive.height)}"${attr("rx", primitive.radius)} fill="${escapeXml(primitive.fill)}"${attr("stroke", primitive.stroke)}${attr("stroke-width", primitive.strokeWidth)} />`;
    case "ellipse":
      return `<ellipse id="${escapeXml(primitive.id)}" cx="${round(primitive.cx)}" cy="${round(primitive.cy)}" rx="${round(primitive.rx)}" ry="${round(primitive.ry)}" fill="${escapeXml(primitive.fill)}"${attr("stroke", primitive.stroke)}${attr("stroke-width", primitive.strokeWidth)} />`;
    case "path":
      return `<path id="${escapeXml(primitive.id)}" d="${escapeXml(primitive.d)}" fill="${escapeXml(primitive.fill)}"${attr("stroke", primitive.stroke)}${attr("stroke-width", primitive.strokeWidth)}${attr("stroke-linecap", primitive.strokeLinecap)}${attr("stroke-linejoin", primitive.strokeLinejoin)}${attr("stroke-dasharray", primitive.strokeDasharray)} />`;
  }
}

function attr(name: string, value: string | number | undefined): string {
  return value === undefined || value === "" ? "" : ` ${name}="${escapeXml(String(value))}"`;
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
