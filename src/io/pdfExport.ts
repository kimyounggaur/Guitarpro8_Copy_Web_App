import type { SceneGraph, ScenePage, ScenePrimitive } from "../engine/layout/sceneGraph";

export function sceneToPdf(scene: SceneGraph): Uint8Array {
  const objects: string[] = [];
  const pageObjectIds: number[] = [];
  const fontObjectId = 3;
  const pagesObjectId = 2;

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[fontObjectId] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

  scene.pages.forEach((page) => {
    const pageObjectId = objects.length;
    const contentObjectId = pageObjectId + 1;
    pageObjectIds.push(pageObjectId);
    objects[pageObjectId] = `<< /Type /Page /Parent ${pagesObjectId} 0 R /MediaBox [0 0 ${round(page.width)} ${round(page.height)}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`;
    const stream = pageToPdfContent(page);
    objects[contentObjectId] = `<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`;
  });

  objects[pagesObjectId] = `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageObjectIds.length} >>`;

  const parts = ["%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n"];
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = byteLength(parts.join(""));
    parts.push(`${id} 0 obj\n${objects[id]}\nendobj\n`);
  }

  const xrefOffset = byteLength(parts.join(""));
  parts.push(`xref\n0 ${objects.length}\n`);
  parts.push("0000000000 65535 f \n");

  for (let id = 1; id < objects.length; id += 1) {
    parts.push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }

  parts.push(`trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return new TextEncoder().encode(parts.join(""));
}

function pageToPdfContent(page: ScenePage): string {
  return page.primitives.map((primitive) => primitiveToPdf(page, primitive)).filter(Boolean).join("\n");
}

function primitiveToPdf(page: ScenePage, primitive: ScenePrimitive): string {
  switch (primitive.type) {
    case "line":
      return [
        "q",
        strokeColor(primitive.stroke),
        `${round(primitive.strokeWidth)} w`,
        `${round(primitive.x1)} ${round(flipY(page, primitive.y1))} m ${round(primitive.x2)} ${round(flipY(page, primitive.y2))} l S`,
        "Q"
      ].join("\n");
    case "rect": {
      const commands = ["q"];
      if (primitive.fill !== "transparent") {
        commands.push(fillColor(primitive.fill));
      }
      if (primitive.stroke) {
        commands.push(strokeColor(primitive.stroke), `${round(primitive.strokeWidth ?? 1)} w`);
      }
      commands.push(`${round(primitive.x)} ${round(flipY(page, primitive.y + primitive.height))} ${round(primitive.width)} ${round(primitive.height)} re ${paintOp(primitive.fill, primitive.stroke)}`);
      commands.push("Q");
      return commands.join("\n");
    }
    case "ellipse":
      return [
        "q",
        fillColor(primitive.fill),
        `${round(primitive.cx - primitive.rx)} ${round(flipY(page, primitive.cy + primitive.ry))} ${round(primitive.rx * 2)} ${round(primitive.ry * 2)} re f`,
        "Q"
      ].join("\n");
    case "text": {
      const approxWidth = primitive.text.length * primitive.fontSize * 0.45;
      const x = primitive.anchor === "middle" ? primitive.x - approxWidth / 2 : primitive.anchor === "end" ? primitive.x - approxWidth : primitive.x;
      return [
        "q",
        fillColor(primitive.fill),
        "BT",
        `/F1 ${round(primitive.fontSize)} Tf`,
        `${round(x)} ${round(flipY(page, primitive.y))} Td`,
        `(${escapePdfText(primitive.text)}) Tj`,
        "ET",
        "Q"
      ].join("\n");
    }
    case "path":
      if (!primitive.stroke && primitive.fill === "none") {
        return "";
      }

      return [
        "q",
        primitive.stroke ? strokeColor(primitive.stroke) : fillColor(primitive.fill),
        `${round(primitive.strokeWidth ?? 1)} w`,
        `% Path retained in SVG export: ${escapePdfComment(primitive.id)}`,
        "Q"
      ].join("\n");
  }
}

function paintOp(fill: string, stroke: string | undefined): string {
  if (fill !== "transparent" && stroke) return "B";
  if (stroke) return "S";
  return "f";
}

function fillColor(color: string): string {
  const [r, g, b] = colorToRgb(color);
  return `${r} ${g} ${b} rg`;
}

function strokeColor(color: string): string {
  const [r, g, b] = colorToRgb(color);
  return `${r} ${g} ${b} RG`;
}

function colorToRgb(color: string): [string, string, string] {
  const hex = /^#?([0-9a-f]{6})$/i.exec(color);

  if (!hex) {
    return ["0", "0", "0"];
  }

  const value = hex[1];
  const rgb = [value.slice(0, 2), value.slice(2, 4), value.slice(4, 6)].map((part) =>
    round(parseInt(part, 16) / 255)
  );
  return [rgb[0], rgb[1], rgb[2]];
}

function flipY(page: ScenePage, y: number): number {
  return page.height - y;
}

function escapePdfText(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function escapePdfComment(value: string): string {
  return value.replace(/\r|\n/g, " ");
}

function round(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
