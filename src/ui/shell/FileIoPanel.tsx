import { t } from "../i18n/messages.en";
import { useState } from "react";
import type { PngScale } from "../../io/print/imageExport";
import { NATIVE_EXTENSION } from "../../io/fileFormat";
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
  onExport: (format: ExportFormat, scale?: PngScale) => void;
}

const importFormats: Array<[ImportFormat, string, string]> = [
  ["ascii", "ASCII", ".txt .tab"],
  ["musicxml", "MusicXML", ".musicxml .xml .mxl"],
  ["midi", "MIDI", ".mid .midi"]
];
const exportFormats: Array<[ExportFormat, string, string]> = [
  ["ascii", t("files.aSCIITab"), t("files.activeTrackTextTablature")],
  ["musicxml", "MusicXML", t("files.exchangeNotationXML")],
  ["midi", "MIDI", t("files.sMFFormat1")],
  ["svg", "SVG", t("files.vectorScoreImage")],
  ["png", "PNG", t("files.renderedPageImage")],
  ["pdf", "PDF", t("files.printOrSaveAsPDF")]
];

export function FileIoPanel(props: FileIoPanelProps) {
  const [pngScale, setPngScale] = useState<PngScale>(2);
  if (!props.open) {
    return null;
  }

  return (
    <section className="fileIoPanel" aria-label={t("files.fileImportAndExport")}>
      <header className="toolPanelHeader">
        <strong>{t("files.fileIO")}</strong>
        <button type="button" onClick={props.onClose} title={t("files.closeFileIO")} aria-label={t("files.closeFileIO")}>
          x
        </button>
      </header>
      <div className="fileIoBody">
        <section className="fileIoColumn">
          <h2>{t("files.native")}</h2>
          <p>{props.score.meta.title || t("files.untitledScore")}</p>
          <span className={props.dirty ? "fileDirtyBadge" : "fileCleanBadge"}>
            {props.dirty ? t("files.unsavedChanges") : t("files.saved")}
          </span>
          <div className="fileButtonGrid">
            <button type="button" onClick={props.onNew}>
              {t("files.new")}
            </button>
            <button type="button" onClick={props.onOpenNative}>
              {t("files.open")}
            </button>
            <button type="button" onClick={props.onSaveNative}>
              {t("files.save")}
            </button>
            <button type="button" onClick={props.onSaveNativeAs}>
              {t("files.saveAs")}
            </button>
          </div>
          <button type="button" onClick={() => props.onExport("native")}>
            {t("files.downloadExtension", { extension: NATIVE_EXTENSION })}
          </button>
        </section>
        <section className="fileIoColumn">
          <h2>{t("files.import")}</h2>
          {importFormats.map(([format, label, hint]) => (
            <button key={format} type="button" onClick={() => props.onImport(format)}>
              <strong>{label}</strong>
              <span>{hint}</span>
            </button>
          ))}
        </section>
        <section className="fileIoColumn">
          <h2>{t("files.export")}</h2>
          <label>
            {t("files.pNGScale")}
            <select value={pngScale} onChange={(event) => {
              const scale = Number(event.target.value);
              if (scale === 1 || scale === 2 || scale === 3) setPngScale(scale);
            }}>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={3}>3×</option>
            </select>
          </label>
          {exportFormats.map(([format, label, hint]) => (
            <button key={format} type="button" onClick={() => props.onExport(format, format === "png" ? pngScale : undefined)}>
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
