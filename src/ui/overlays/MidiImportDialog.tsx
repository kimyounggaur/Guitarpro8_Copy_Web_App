import { useState } from "react";
import { t } from "../i18n/messages.en";
import { FileDialog } from "./FileDialog";

export function MidiImportDialog({ onChoose }: { onChoose: (detectTriplets: boolean | null) => void }) {
  const [detectTriplets, setDetectTriplets] = useState(false);
  return (
    <FileDialog title={t("midiImportTitle")} onCancel={() => onChoose(null)}>
      <label>
        <input type="checkbox" checked={detectTriplets}
          onChange={(event) => setDetectTriplets(event.currentTarget.checked)} />
        {t("midiTriplets")}
      </label>
      <div className="fileDecisionActions">
        <button type="button" onClick={() => onChoose(detectTriplets)}>{t("midiImport")}</button>
        <button type="button" onClick={() => onChoose(null)}>{t("cancel")}</button>
      </div>
    </FileDialog>
  );
}
