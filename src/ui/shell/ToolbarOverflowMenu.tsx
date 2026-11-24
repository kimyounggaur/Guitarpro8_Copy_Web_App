import { useId, useRef, useState } from "react";
import { IconButton, Popover, type IconName } from "../components";
import { t } from "../i18n/messages.en";

export interface ToolbarAction {
  id: string;
  label: string;
  icon: IconName;
  shortcut?: string;
  run: () => void;
  disabled?: boolean;
  pressed?: boolean;
  testId?: string;
}
export interface ToolbarGroup {
  id: string;
  title: string;
  order: number;
  actions: ToolbarAction[];
}

export function ToolbarOverflowMenu({ groups }: { groups: ToolbarGroup[] }) {
  const id = useId(),
    anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div
      className="toolbarOverflow"
      style={{ order: 15 }}
      onBlur={(event) => {
        if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget))
          setOpen(false);
      }}
    >
      <IconButton
        ref={anchor}
        label={t("toolbar.moreToolbarControls")}
        icon="more"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      />
      <Popover
        id={id}
        open={open}
        anchor={anchor}
        onClose={() => setOpen(false)}
        label={t("toolbar.moreToolbarControls")}
        className="toolbarOverflowPanel"
      >
        {groups.map((group) => (
          <section key={group.id} aria-label={group.title}>
            <h2>{group.title}</h2>
            {group.actions.map((action) => {
              const title = action.shortcut ? `${action.label} ${action.shortcut}` : action.label;
              return (
                <button
                  type="button"
                  key={action.id}
                  title={title}
                  disabled={action.disabled}
                  aria-pressed={action.pressed}
                  data-testid={action.testId}
                  onClick={() => {
                    anchor.current?.focus();
                    setOpen(false);
                    action.run();
                  }}
                >
                  {action.label}
                  {action.shortcut && <kbd>{action.shortcut}</kbd>}
                </button>
              );
            })}
          </section>
        ))}
      </Popover>
    </div>
  );
}
