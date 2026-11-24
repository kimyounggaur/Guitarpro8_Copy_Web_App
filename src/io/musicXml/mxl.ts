import { unzipSync } from "fflate";
import { element, elements, xmlRoot } from "./common";
import { readMusicXml, type MusicXmlImportResult } from "./import";

const CONTAINER = "META-INF/container.xml";
const MAX_CONTAINER_BYTES = 1024 * 1024;
const MAX_SCORE_BYTES = 64 * 1024 * 1024;

export function readCompressedMusicXml(bytes: Uint8Array): MusicXmlImportResult {
  const container = xmlRoot(readEntry(bytes, CONTAINER, MAX_CONTAINER_BYTES));
  if (container.localName !== "container") {
    throw new Error("The compressed MusicXML container is invalid.");
  }
  const rootfiles = elements(element(container, "rootfiles"), "rootfile");
  const entry = rootfiles.find((file) =>
    file.getAttribute("media-type") === "application/vnd.recordare.musicxml+xml"
  ) ?? rootfiles[0];
  const path = entry?.getAttribute("full-path");
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").includes("..")) {
    throw new Error("The compressed MusicXML archive does not name a valid score.");
  }
  return readMusicXml(readEntry(bytes, path, MAX_SCORE_BYTES));
}

function readEntry(bytes: Uint8Array, path: string, limit: number): string {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes, { filter: ({ name, originalSize }) => name === path && originalSize <= limit });
  } catch {
    throw new Error("The compressed MusicXML archive could not be read.");
  }
  const entry = Object.prototype.hasOwnProperty.call(entries, path) ? entries[path] : undefined;
  if (!entry) throw new Error(`The compressed MusicXML archive has a missing or oversized entry: ${path}.`);
  return new TextDecoder().decode(entry);
}
