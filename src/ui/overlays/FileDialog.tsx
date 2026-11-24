import { useId, useRef, type ReactNode } from "react";
import { useDialogFocus } from "./useDialogFocus";

interface FileDialogProps {
  title: string;
  role?: "dialog" | "alertdialog";
  onCancel: () => void;
  children: ReactNode;
}

export function FileDialog({ title, role, onCancel, children }: FileDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useDialogFocus(dialog, true, "native");

  return (
    <dialog
      ref={dialog}
      className="fileDecisionDialog"
      role={role}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  );
}
