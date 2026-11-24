import { t } from "../i18n/messages.en";
import type { RecoverySnapshot } from "../../store/autosave";
import { FileDialog } from "./FileDialog";

interface RecoveryDialogProps {
  snapshots: RecoverySnapshot[];
  onRecover: (snapshot: RecoverySnapshot) => void;
  onDiscard: (snapshot: RecoverySnapshot) => void;
  onDismiss: () => void;
}

export function RecoveryDialog({ snapshots, onRecover, onDiscard, onDismiss }: RecoveryDialogProps) {
  return (
    <FileDialog title={t("dialog.recoverUnsavedWork")} onCancel={onDismiss}>
      <p>{t("dialog.chooseRecoverySnapshot")}</p>
      <ul className="recoveryList">
        {snapshots.map((snapshot) => (
          <li key={snapshot.documentId}>
            <strong>{snapshot.title}</strong>
            <time dateTime={snapshot.savedAt}>{new Date(snapshot.savedAt).toLocaleString()}</time>
            <div className="fileDecisionActions">
              <button type="button" onClick={() => onRecover(snapshot)}>{t("dialog.recover")}</button>
              <button type="button" onClick={() => onDiscard(snapshot)}>{t("dialog.discard")}</button>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" autoFocus onClick={onDismiss}>{t("dialog.later")}</button>
    </FileDialog>
  );
}
