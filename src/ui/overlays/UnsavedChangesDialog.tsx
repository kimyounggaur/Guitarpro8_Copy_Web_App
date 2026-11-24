import { t } from "../i18n/messages.en";
import { FileDialog } from "./FileDialog";

export type UnsavedChoice = "save" | "discard" | "cancel";

export function UnsavedChangesDialog({ onChoose }: { onChoose: (choice: UnsavedChoice) => void }) {
  return (
    <FileDialog title={t("dialog.unsavedChanges")} onCancel={() => onChoose("cancel")}>
      <p>{t("dialog.confirmSaveBeforeContinuing")}</p>
      <div className="fileDecisionActions">
        <button type="button" onClick={() => onChoose("save")}>{t("dialog.saveAndContinue")}</button>
        <button type="button" onClick={() => onChoose("discard")}>{t("dialog.discardAndContinue")}</button>
        <button type="button" autoFocus onClick={() => onChoose("cancel")}>{t("cancel")}</button>
      </div>
    </FileDialog>
  );
}
