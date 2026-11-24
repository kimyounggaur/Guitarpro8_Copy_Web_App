import { t } from "../i18n/messages.en";
import { useEffect, useRef, useState } from "react";
import { shortcutLabel, type Platform } from "../../commands/keymap";
import { availableMenuGroups } from "../../commands/menus";

export function ApplicationMenus({
  commandIds, platform, onAction
}: {
  commandIds: ReadonlySet<string>;
  platform: Platform;
  onAction: (input: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const nav = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const groups = availableMenuGroups(commandIds);
  useEffect(() => {
    function closeOutside(event: PointerEvent): void {
      if (event.target instanceof Node && !nav.current?.contains(event.target)) setOpen(null);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  function activate(input: string) {
    setOpen(null);
    onAction(input);
  }

  return (
    <nav ref={nav} className="menuBar" aria-label={t("navigation.applicationMenus")} onKeyDown={(event) => {
      if (event.key !== "Escape" || !open) return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(null);
      trigger.current?.focus();
    }}>
      {groups.map(({ name, actions }) => (
        <div key={name} className="applicationMenu">
          <button type="button" aria-expanded={open === name} onClick={(event) => {
            trigger.current = event.currentTarget;
            setOpen(open === name ? null : name);
          }}>{name}</button>
          {open === name && <ul aria-label={t("navigation.menuActions", { menu: name })} className="applicationMenuList">
            {actions.map((action) => {
              const shortcut = shortcutLabel(action.commandId ?? action.appAction ?? action.id, platform);
              return <li key={action.id}><button type="button" onClick={() => activate(`@ ${name} > ${action.label}`)}>
                <span>{action.label}</span>
                {shortcut && <kbd>{shortcut}</kbd>}
              </button></li>;
            })}
          </ul>}
        </div>
      ))}
    </nav>
  );
}
