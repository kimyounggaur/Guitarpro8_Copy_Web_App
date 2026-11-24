import { useLayoutEffect, type RefObject } from "react";

const focusable = [
  "a[href]", "button", "input", "select", "textarea", "summary",
  '[tabindex]:not([tabindex="-1"])'
].join(",");

export function useDialogFocus<ElementType extends HTMLElement>(
  ref: RefObject<ElementType>,
  open: boolean,
  kind: "native" | "overlay"
): void {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!open || !element) return;

    const opener = document.activeElement;
    const dialog = kind === "native" && element instanceof HTMLDialogElement ? element : null;
    dialog?.showModal();
    const resetOutside = !dialog ? inertOutside(element) : undefined;
    if (!dialog) {
      (element.querySelector<HTMLElement>("[data-dialog-initial-focus]") ?? availableControls(element)[0] ?? element)
        .focus({ preventScroll: true });
    }

    function keepFocusInDialog(event: KeyboardEvent) {
      if (event.key !== "Tab" || event.defaultPrevented || !element) return;
      const controls = availableControls(element);
      const first = controls[0];
      const last = controls[controls.length - 1];
      const active = document.activeElement;
      if (!first || !last) {
        event.preventDefault();
        element.focus({ preventScroll: true });
      } else if (!element.contains(active) || (event.shiftKey ? active === first : active === last)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      }
    }
    element.addEventListener("keydown", keepFocusInDialog);

    return () => {
      element.removeEventListener("keydown", keepFocusInDialog);
      dialog?.close();
      resetOutside?.();
      if (opener instanceof HTMLElement && opener !== document.body && opener.isConnected) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [ref, open, kind]);
}

function inertOutside(element: HTMLElement): () => void {
  const changed: HTMLElement[] = [];
  for (let branch: HTMLElement | null = element; branch?.parentElement && branch !== document.body; branch = branch.parentElement) {
    for (const sibling of branch.parentElement.children) {
      if (sibling !== branch && sibling instanceof HTMLElement && !sibling.inert) {
        sibling.inert = true;
        changed.push(sibling);
      }
    }
  }
  return () => { changed.forEach((sibling) => { sibling.inert = false; }); };
}

function availableControls(element: HTMLElement): HTMLElement[] {
  return Array.from(element.querySelectorAll<HTMLElement>(focusable)).filter((control) =>
    control.tabIndex >= 0
    && !control.matches(":disabled")
    && !control.closest("[inert], [hidden], [aria-hidden='true']")
    && control.getClientRects().length > 0
    && getComputedStyle(control).visibility === "visible"
  );
}
