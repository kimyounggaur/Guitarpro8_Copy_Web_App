import { t } from "../i18n/messages.en";
import { useEffect, useId, useRef, useState } from "react";

export interface ToolbarAction {
  id: string;
  label: string;
  title: string;
  run?: () => void;
  disabled?: boolean;
  pressed?: boolean;
  testId?: string;
}

export interface ToolbarGroup {
  id: string;
  title: string;
  className: string;
  actions: ToolbarAction[];
}

export function ToolbarOverflowMenu({ groups }: { groups: ToolbarGroup[] }) {
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function closeWhenOutside(event: PointerEvent) {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeWhenOutside);
    return () => document.removeEventListener("pointerdown", closeWhenOutside);
  }, [open]);

  return (
    <div
      ref={wrapper}
      className="toolbarOverflow"
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="toolbarMore"
        aria-label={t("toolbar.moreToolbarControls")}
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        onClick={() => setOpen((expanded) => !expanded)}
      >
        ⋯
      </button>
      {open ? (
        <div id={panelId} className="toolbarOverflowPanel">
          {groups.map((group) => (
            <section key={group.id} aria-label={group.title}>
              <h2>{group.title}</h2>
              {group.actions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  title={action.title}
                  disabled={action.disabled}
                  aria-pressed={action.pressed}
                  data-testid={action.testId}
                  onClick={() => {
                    if (wrapper.current?.contains(document.activeElement)) {
                      trigger.current?.focus();
                    }
                    setOpen(false);
                    action.run?.();
                  }}
                >
                  {action.title}
                </button>
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
