import { useEffect, useRef, useState, type FormEvent } from "react";
import { DEFAULT_PASTE, type PasteOptions } from "../../engine/editing/clipboard";

export function SpecialPasteDialog({
  onApply, onCancel
}: {
  onApply: (options: PasteOptions) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<PasteOptions>(DEFAULT_PASTE);

  useEffect(() => {
    const opener = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onApply(options);
  }

  return (
    <dialog ref={dialog} className="fileDecisionDialog" aria-label="Special paste" onCancel={onCancel}>
      <form onSubmit={submit}>
        <h2>Special paste</h2>
        <label>
          Repetitions
          <input
            autoFocus
            type="number"
            min="1"
            max="99"
            required
            value={options.repeatCount}
            onChange={(event) => setOptions({ ...options, repeatCount: Number(event.target.value) })}
          />
        </label>
        <label>
          Paste
          <select value={options.content} onChange={(event) => {
            const content = event.target.value;
            if (content === "all" || content === "notes" || content === "effects") {
              setOptions({ ...options, content });
            }
          }}>
            <option value="all">Notes and effects</option>
            <option value="notes">Notes only</option>
            <option value="effects">Effects only</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.insert && options.content !== "effects"}
            disabled={options.content === "effects"}
            onChange={(event) => setOptions({ ...options, insert: event.target.checked })}
          />
          Insert measures
        </label>
        <div className="fileDecisionActions">
          <button type="submit">Paste</button>
          <button type="button" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    </dialog>
  );
}
