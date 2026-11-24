import type { Score } from "../../model/types";
import { unrollScore } from "../unroll/unrollScore";
import { compilePlayback } from "./compile";

globalThis.addEventListener("message", (event: MessageEvent<{ score: Score; speed: number }>) => {
  const { score, speed } = event.data;
  const order = unrollScore(score);
  const result = compilePlayback(score, order, { mode: "relative", percent: speed });
  globalThis.postMessage({ order, events: result.events });
});
