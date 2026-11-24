import { useEffect, useId, useRef, type ReactNode } from "react";

interface FileDialogProps {
  title: string;
  onCancel: () => void;
  children: ReactNode;
}

export function FileDialog({ title, onCancel, children }: FileDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    element.showModal();
    return () => element.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      className="fileDecisionDialog"
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
