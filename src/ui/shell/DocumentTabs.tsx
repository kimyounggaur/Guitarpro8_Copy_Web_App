import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { DocumentTabState } from "../../store/documentStore";

export function DocumentTabs({ documents, activeId, onSelect, onNew, onClose, onSave }: {
  documents: DocumentTabState[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: (ids: string[]) => void;
  onSave: (id: string) => void;
}) {
  const [contextId, setContextId] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const items = useRef(new Map<string, HTMLButtonElement>());
  const selected = documents.findIndex(({ id }) => id === contextId);

  useEffect(() => {
    items.current.get(activeId)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [activeId]);

  useEffect(() => {
    if (!contextId) return;
    menu.current?.querySelector("button")?.focus();
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setContextId(null);
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [contextId]);

  function keyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey)) {
      event.preventDefault();
      setContextId(documents[index].id);
      return;
    }
    const next = event.key === "Home" ? 0 : event.key === "End" ? documents.length - 1 :
      event.key === "ArrowRight" ? (index + 1) % documents.length :
      event.key === "ArrowLeft" ? (index + documents.length - 1) % documents.length : -1;
    if (next >= 0 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      onSelect(documents[next].id);
      items.current.get(documents[next].id)?.focus();
    }
  }

  function runMenu(action: "save" | "close" | "others" | "right"): void {
    const document = documents[selected];
    if (!document) return;
    setContextId(null);
    items.current.get(document.id)?.focus();
    if (action === "save") onSave(document.id);
    else if (action === "close") onClose([document.id]);
    else onClose((action === "right" ? documents.slice(selected + 1) : documents.filter(({ id }) => id !== document.id)).map(({ id }) => id));
  }

  return <div className="tabScoreDocumentStrip" data-testid="tab-bar" ref={root}>
    <div className="tabScoreDocumentScroll">
      <div className="tabScoreDocumentList" role="tablist" aria-label="Open documents">
        {documents.map((document, index) => (
          <button type="button" role="tab" aria-selected={document.id === activeId}
            key={document.id} tabIndex={document.id === activeId ? 0 : -1} data-testid="document-tab"
            ref={(element) => {
              if (element) items.current.set(document.id, element);
              else items.current.delete(document.id);
            }}
            title={document.title} onKeyDown={(event) => keyDown(event, index)} onClick={() => onSelect(document.id)}
            onContextMenu={(event) => { event.preventDefault(); setContextId(document.id); }}
            onAuxClick={(event) => {
              if (event.button === 1) { event.preventDefault(); onClose([document.id]); }
            }}>
            {document.dirty && <span className="documentDirtyDot" aria-label="Unsaved changes">●</span>}
            {document.locked && <span role="img" aria-label="Read-only">🔒</span>}
            <span className="documentTitle">{document.title}</span>
          </button>
        ))}
      </div>
      <div className="documentCloseActions">
        {documents.map((document) => <div key={document.id}>
          <button type="button" className="closeDocument" aria-label={`Close ${document.title}`}
            onContextMenu={(event) => { event.preventDefault(); setContextId(document.id); }}
            tabIndex={document.id === activeId ? 0 : -1} data-active={document.id === activeId}
            title={`Close ${document.title}`} onClick={() => onClose([document.id])}>×</button>
        </div>)}
      </div>
    </div>
    <button type="button" className="createDocument" aria-label="New document tab" data-testid="tab-add"
      title="New document tab" onClick={onNew}>+</button>
    {contextId && selected >= 0 && <div className="documentContextMenu" ref={menu}
      role="group" aria-label={`Actions for ${documents[selected].title}`}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          setContextId(null);
          items.current.get(contextId)?.focus();
        }
      }}>
      <button type="button" onClick={() => runMenu("save")}>Save</button>
      <button type="button" onClick={() => runMenu("close")}>Close</button>
      <button type="button" disabled={documents.length < 2} onClick={() => runMenu("others")}>Close other tabs</button>
      <button type="button" disabled={selected >= documents.length - 1} onClick={() => runMenu("right")}>Close tabs to the right</button>
    </div>}
  </div>;
}
