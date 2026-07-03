import type { Score } from "../../model/types";

export type ImportFormat = "ascii" | "musicxml" | "midi";
export type ExportFormat = "native" | "ascii" | "musicxml" | "midi" | "svg" | "png" | "pdf";

export interface FileIoPanelProps {
  open: boolean;
  score: Score;
  dirty: boolean;
  status: string;
  onClose: () => void;
  onNew: () => void;
  onOpenNative: () => void;
  onSaveNative: () => void;
  onSaveNativeAs: () => void;
  onImport: (format: ImportFormat) => void;
  onExport: (format: ExportFormat) => void;
}

const importFormats: Array<[ImportFormat, string, string]> = [
  ["ascii", "ASCII", ".txt .tab"],
  ["musicxml", "MusicXML", ".musicxml .xml"],
  ["midi", "MIDI", ".mid .midi"]
];
const exportFormats: Array<[ExportFormat, string, string]> = [
  ["ascii", "ASCII Tab", "Active track text tablature"],
  ["musicxml", "MusicXML", "Exchange notation XML"],
  ["midi", "MIDI", "SMF format 1"],
  ["svg", "SVG", "Vector score image"],
  ["png", "PNG", "Rendered page image"],
  ["pdf", "PDF", "Vector document"]
];

export function FileIoPanel(props: FileIoPanelProps) {
  if (!props.open) {
    return null;
  }

  return (
    <section className="fileIoPanel" aria-label="File import and export">
      <header className="toolPanelHeader">
        <strong>File I/O</strong>
        <button type="button" onClick={props.onClose} title="Close file I/O">
          x
        </button>
      </header>
      <div className="fileIoBody">
        <section className="fileIoColumn">
          <h2>Native</h2>
          <p>{props.score.meta.title || "Untitled Score"}</p>
          <span className={props.dirty ? "fileDirtyBadge" : "fileCleanBadge"}>
            {props.dirty ? "Unsaved changes" : "Saved"}
          </span>
          <div className="fileButtonGrid">
            <button type="button" onClick={props.onNew}>
              New
            </button>
            <button type="button" onClick={props.onOpenNative}>
              Open
            </button>
            <button type="button" onClick={props.onSaveNative}>
              Save
            </button>
            <button type="button" onClick={props.onSaveNativeAs}>
              Save As
            </button>
          </div>
          <button type="button" onClick={() => props.onExport("native")}>
            Download .gp
          </button>
        </section>
        <section className="fileIoColumn">
          <h2>Import</h2>
          {importFormats.map(([format, label, hint]) => (
            <button key={format} type="button" onClick={() => props.onImport(format)}>
              <strong>{label}</strong>
              <span>{hint}</span>
            </button>
          ))}
        </section>
        <section className="fileIoColumn">
          <h2>Export</h2>
          {exportFormats.map(([format, label, hint]) => (
            <button key={format} type="button" onClick={() => props.onExport(format)}>
              <strong>{label}</strong>
              <span>{hint}</span>
            </button>
          ))}
        </section>
      </div>
      <footer className="fileIoStatus">{props.status}</footer>
    </section>
  );
}
