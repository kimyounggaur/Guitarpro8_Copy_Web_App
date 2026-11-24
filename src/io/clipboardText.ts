import { z } from "zod";
import type { ClipboardPayload } from "../engine/editing/types";
import { clipboardBarSchema, masterBarSchema } from "./scoreSchema";

const PREFIX = "TAB-SCORE-CLIPBOARD/1\n";
const clipboardSchema: z.ZodType<ClipboardPayload> = z.object({
  mode: z.enum(["single", "multitrack"]),
  source: z.object({
    trackId: z.string(), barIndex: z.number().int(), voiceIndex: z.number().int(),
    beatIndex: z.number().int(), noteIndex: z.number().int()
  }).nullable(),
  wholeBars: z.boolean(),
  masterBars: z.array(masterBarSchema).min(1),
  tracks: z.array(z.object({
    kind: z.enum(["stringed", "pitched", "percussion"]),
    bars: z.array(clipboardBarSchema)
  })).min(1)
}).refine(({ masterBars, tracks }) => tracks.every(({ bars }) => bars.length === masterBars.length));

export function encodeClipboardText(payload: ClipboardPayload): string {
  return PREFIX + JSON.stringify(payload);
}

export function decodeClipboardText(text: string): ClipboardPayload | null {
  if (!text.startsWith(PREFIX)) return null;
  try {
    const parsed = clipboardSchema.safeParse(JSON.parse(text.slice(PREFIX.length)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
