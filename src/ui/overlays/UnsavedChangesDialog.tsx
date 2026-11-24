import { FileDialog } from "./FileDialog";

export type UnsavedChoice = "save" | "discard" | "cancel";

export function UnsavedChangesDialog({ onChoose }: { onChoose: (choice: UnsavedChoice) => void }) {
  return (
    <FileDialog title="Unsaved changes" onCancel={() => onChoose("cancel")}>
      <p>Save the current score before continuing?</p>
      <div className="fileDecisionActions">
        <button type="button" onClick={() => onChoose("save")}>Save and continue</button>
        <button type="button" onClick={() => onChoose("discard")}>Discard and continue</button>
        <button type="button" autoFocus onClick={() => onChoose("cancel")}>Cancel</button>
      </div>
    </FileDialog>
  );
}
