import { zipSync, strToU8 } from "fflate";
import type { SceneGraph, ScenePage } from "../../engine/layout/sceneGraph";
import { sceneFirstPageSvg, type SvgExportOptions } from "../vectorExport";

export type PngScale = 1 | 2 | 3;

let outlineFont: Promise<SvgExportOptions["musicPath"]> | undefined;

export async function exportPageImages(
  scene: SceneGraph,
  format: "svg" | "png",
  scale: PngScale = 2
): Promise<{ blob: Blob; extension: ".svg" | ".png" | ".zip"; count: number }> {
  if (!scene.pages.length) throw new Error("내보낼 악보 페이지가 없습니다.");
  const musicPath = await (outlineFont ??= loadOutlines().catch((error: unknown) => {
    outlineFont = undefined;
    throw error;
  }));
  const files: Record<string, Uint8Array> = {};
  for (const [index, page] of scene.pages.entries()) {
    const svg = sceneFirstPageSvg({ pages: [page] }, { musicPath });
    const blob = format === "svg" ? new Blob([svg], { type: "image/svg+xml" }) : await png(svg, page, scale);
    if (scene.pages.length === 1) return { blob, extension: format === "svg" ? ".svg" : ".png", count: 1 };
    const pageName = `page-${String(index + 1).padStart(3, "0")}.${format}`;
    files[pageName] = format === "svg" ? strToU8(svg) : new Uint8Array(await blob.arrayBuffer());
  }
  const zip = zipSync(files);
  return { blob: new Blob([Uint8Array.from(zip).buffer], { type: "application/zip" }), extension: ".zip", count: scene.pages.length };
}

async function loadOutlines(): Promise<NonNullable<SvgExportOptions["musicPath"]>> {
  const [library, response] = await Promise.all([
    import("opentype.js"),
    fetch(`${import.meta.env.BASE_URL}fonts/bravura/Bravura.woff`)
  ]);
  if (!response.ok) throw new Error("악보 글꼴을 불러오지 못했습니다.");
  const font = library.parse(await response.arrayBuffer());
  return ({ text, fontFamily, x, y, fontSize, anchor }) => {
    if (!fontFamily?.startsWith("Bravura")) return undefined;
    const width = font.getAdvanceWidth(text, fontSize);
    const left = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
    return font.getPath(text, left, y, fontSize).toPathData(3);
  };
}

async function png(svg: string, page: ScenePage, scale: PngScale): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(page.width * scale);
    canvas.height = Math.round(page.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("PNG를 그릴 수 없습니다.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG 파일을 만들 수 없습니다.")), "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
