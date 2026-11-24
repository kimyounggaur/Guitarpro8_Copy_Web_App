import { t } from "../i18n/messages.en";
import { useRef, useState, type FormEvent } from "react";
import { DEFAULT_PASTE, type PasteOptions } from "../../engine/editing/clipboard";
import { useDialogFocus } from "./useDialogFocus";

export function SpecialPasteDialog({
  onApply, onCancel
}: {
  onApply: (options: PasteOptions) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<PasteOptions>(DEFAULT_PASTE);

  useDialogFocus(dialog, true, "native");

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onApply(options);
  }

  return (
    <dialog ref={dialog} className="fileDecisionDialog" aria-label={t("dialog.specialPaste")} onCancel={onCancel}>
      <form onSubmit={submit}>
        <h2>{t("dialog.specialPaste")}</h2>
        <label>
          {t("dialog.repetitions")}
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
          {t("dialog.paste")}
          <select value={options.content} onChange={(event) => {
            const content = event.target.value;
            if (content === "all" || content === "notes" || content === "effects") {
              setOptions({ ...options, content });
            }
          }}>
            <option value="all">{t("dialog.notesAndEffects")}</option>
            <option value="notes">{t("dialog.notesOnly")}</option>
            <option value="effects">{t("dialog.effectsOnly")}</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={options.insert && options.content !== "effects"}
            disabled={options.content === "effects"}
            onChange={(event) => setOptions({ ...options, insert: event.target.checked })}
          />
          {t("dialog.insertMeasures")}
        </label>
        <div className="fileDecisionActions">
          <button type="submit">{t("dialog.paste")}</button>
          <button type="button" onClick={onCancel}>{t("cancel")}</button>
        </div>
      </form>
    </dialog>
  );
}
