import { expect, it } from "vitest";
import { createEmptyScore } from "../model/factory";
import { defaultExportName, buildExportFileName } from "./exportNames";

it("[C11] uses one local date and clock for filenames during Seoul early morning", () => {
  const previous = process.env.TZ;
  process.env.TZ = "Asia/Seoul";
  try {
    const score = createEmptyScore();
    score.meta.title = "악보";
    expect(buildExportFileName("%T-%d-%h", score, null, ".pdf", new Date("2026-11-23T17:00:00.000Z")))
      .toEqual("악보-2026-11-24-02-00.pdf");
    expect(defaultExportName(score, "mid")).toMatch(/-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}\.mid$/);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
