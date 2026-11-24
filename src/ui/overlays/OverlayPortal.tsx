import { useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

function overlayHost(anchor?: RefObject<HTMLElement>): HTMLElement {
  // An overlay opened inside a native modal must stay within its active subtree.
  const modal = anchor?.current?.closest<HTMLElement>("dialog:modal");
  if (modal) return modal;
  const existing = document.getElementById("editor-overlays");
  if (existing) return existing;
  const host = document.createElement("div");
  host.id = "editor-overlays";
  document.body.appendChild(host);
  return host;
}

export function OverlayPortal({ children, anchor }: { children: ReactNode; anchor?: RefObject<HTMLElement> }) {
  const [host] = useState(() => overlayHost(anchor));
  return createPortal(children, host);
}
