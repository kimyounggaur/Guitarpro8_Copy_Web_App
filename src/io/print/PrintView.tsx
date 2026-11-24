import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { SceneGraph } from "../../engine/layout/sceneGraph";
import { SvgRenderer } from "../../engine/render/SvgRenderer";

const MILLIMETERS_PER_CSS_PIXEL = 25.4 / 96;
let activePrint: (() => void) | undefined;

export function PrintView({ scene }: { scene: SceneGraph }) {
  return (
    <div className="printScorePages" aria-label="인쇄용 악보">
      {scene.pages.map((page) => (
        <section key={page.id} style={{ width: `${page.width * MILLIMETERS_PER_CSS_PIXEL}mm`, height: `${page.height * MILLIMETERS_PER_CSS_PIXEL}mm` }}>
          <SvgRenderer scene={{ ...scene, pages: [page] }} displayMode="vertical-page" zoom={100} />
        </section>
      ))}
    </div>
  );
}

export async function printScore(scene: SceneGraph, title: string): Promise<void> {
  const firstPage = scene.pages[0];
  if (!firstPage) throw new Error("인쇄할 페이지가 없습니다.");
  activePrint?.();
  const target = document.createElement("div");
  target.className = "printScoreRoot";
  target.setAttribute("aria-hidden", "true");
  const paper = document.createElement("style");
  paper.textContent = `@page { size: ${firstPage.width * MILLIMETERS_PER_CSS_PIXEL}mm ${firstPage.height * MILLIMETERS_PER_CSS_PIXEL}mm; margin: 0 }`;
  document.head.append(paper);
  document.body.append(target);
  document.body.classList.add("printScoreActive");
  const root = createRoot(target);
  function cleanup() {
    if (activePrint !== cleanup) return;
    window.removeEventListener("afterprint", cleanup);
    activePrint = undefined;
    root.unmount();
    target.remove();
    paper.remove();
    document.body.classList.remove("printScoreActive");
  }
  activePrint = cleanup;
  try {
    const printScene: SceneGraph = { ...scene, pages: scene.pages.map((page) => {
      if (!title || page.primitives.some(({ id }) => id.endsWith("header-title"))) return page;
      return { ...page, primitives: [...page.primitives, {
        id: `${page.id}-print-title`, type: "text", text: title,
        x: page.width / 2, y: 32, fill: "#111827", fontSize: 16, anchor: "middle"
      }] };
    }) };
    flushSync(() => root.render(<PrintView scene={printScene} />));
    await document.fonts.ready;
    if (activePrint !== cleanup) return;
    window.addEventListener("afterprint", cleanup, { once: true });
    window.print();
  } catch (error) {
    cleanup();
    throw error;
  }
}
