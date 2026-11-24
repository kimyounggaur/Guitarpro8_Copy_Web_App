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
    <FileDialog title="Recover unsaved work" onCancel={onDismiss}>
      <p>Choose an automatically saved score to restore.</p>
      <ul className="recoveryList">
        {snapshots.map((snapshot) => (
          <li key={snapshot.documentId}>
            <strong>{snapshot.title}</strong>
            <time dateTime={snapshot.savedAt}>{new Date(snapshot.savedAt).toLocaleString()}</time>
            <div className="fileDecisionActions">
              <button type="button" onClick={() => onRecover(snapshot)}>Recover</button>
              <button type="button" onClick={() => onDiscard(snapshot)}>Discard</button>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" autoFocus onClick={onDismiss}>Later</button>
    </FileDialog>
  );
}
