import { t } from "../i18n/messages.en";
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { shortcutLabel, type Platform } from "../../commands/keymap";
import { desktopMenuGroups, type MenuItem, type MenuSlots, type MenuState } from "../../commands/menus";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useViewStore } from "../../store/viewStore";
import "../styles/menus.css";

interface Props {
  commandIds: ReadonlySet<string>;
  platform: Platform;
  onAction: (input: string) => void;
  menuState?: MenuState;
  slots?: MenuSlots;
}

export function ApplicationMenus({ commandIds, platform, onAction, menuState, slots }: Props) {
  const panelVisibility = usePreferencesStore(state => state.panelVisibility);
  const displayMode = useViewStore(state => state.displayMode);
  const groups = desktopMenuGroups(commandIds, menuState ?? { panelVisibility, displayMode }, slots);
  const [open, setOpen] = useState<number | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [topFocus, setTopFocus] = useState(0);
  const [focus, setFocus] = useState<{ key: string } | null>(null);
  const nav = useRef<HTMLElement>(null);
  const keys = useRef({ text: "", time: 0 });
  const instance = useId();
  const visibleGroup = open === null ? undefined : groups[open];
  const parent = visibleGroup?.items.find(item => item.id === sub);
  const node = (key: string) => nav.current?.querySelector<HTMLButtonElement>(`[data-menu-key="${CSS.escape(key)}"]`);
  const buttonKey = (index: number) => `group:${groups[index].name}`;

  useLayoutEffect(() => {
    if (focus) node(focus.key)?.focus();
  }, [focus]);
  useEffect(() => {
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !nav.current?.contains(event.target)) {
        setOpen(null);
        setSub(null);
      }
    }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  function close(restore: boolean) {
    if (restore && open !== null) node(buttonKey(open))?.focus();
    setOpen(null);
    setSub(null);
    keys.current.text = "";
  }
  function openGroup(index: number, last = false) {
    const items = groups[index].items;
    const item = (last ? [...items].reverse() : items).find(item => !item.disabledReason);
    setOpen(index);
    setTopFocus(index);
    setSub(null);
    setFocus({ key: item?.id ?? buttonKey(index) });
    keys.current.text = "";
  }
  function enterItem(item: MenuItem, group: number) {
    if (item.disabledReason) return;
    if (item.children?.length) {
      setSub(item.id);
      setFocus({ key: item.children.find(child => !child.disabledReason)?.id ?? item.id });
      keys.current.text = "";
      return;
    }
    close(true);
    if (item.onSelect) item.onSelect();
    else if (item.action) onAction(`@ ${groups[group].name} > ${item.action.label}`);
  }
  function leaveSubmenu() {
    if (sub) setFocus({ key: sub });
    setSub(null);
    keys.current.text = "";
  }
  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (!(event.target instanceof HTMLButtonElement) || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
    const key = event.key;
    const targetKey = event.target.dataset.menuKey;
    if (!targetKey) return;
    const top = groups.findIndex((_, i) => buttonKey(i) === targetKey);
    const isTop = top >= 0;
    const current = parent?.children ?? visibleGroup?.items ?? [];
    const entries = current.filter(item => !item.disabledReason);
    const index = entries.findIndex(item => item.id === targetKey);
    const item = entries[index];
    const moveToGroup = (next: number) => {
      if (open !== null) openGroup(next);
      else setFocus({ key: buttonKey(next) });
    };
    if (key === "Tab") {
      if (open !== null) close(true);
      return;
    }
    if (key === "Escape" && open !== null) {
      if (sub) leaveSubmenu();
      else close(true);
    } else if (key === "ArrowRight" || key === "ArrowLeft") {
      if (key === "ArrowRight" && item?.children?.length && open !== null) enterItem(item, open);
      else if (key === "ArrowLeft" && sub) leaveSubmenu();
      else {
        const direction = key === "ArrowRight" ? 1 : -1;
        moveToGroup(((isTop ? top : (open ?? 0)) + direction + groups.length) % groups.length);
      }
    } else if (key === "ArrowDown" || key === "ArrowUp" || key === "Home" || key === "End") {
      if (isTop) {
        if (key === "Home" || key === "End") {
          moveToGroup(key === "Home" ? 0 : groups.length - 1);
        } else openGroup(top, key === "ArrowUp");
      } else if (entries.length) {
        const next = key === "Home" ? 0 : key === "End" ? entries.length - 1 :
          (index + (key === "ArrowDown" ? 1 : -1) + entries.length) % entries.length;
        setFocus({ key: entries[next].id });
        keys.current.text = "";
      }
    } else if (key === "Enter" || key === " ") {
      if (isTop) open === top ? close(true) : openGroup(top);
      else if (item && open !== null) enterItem(item, open);
    } else if (key.length === 1) {
      const time = performance.now();
      const char = key.toLocaleLowerCase();
      const text = time - keys.current.time < 700 ? keys.current.text + char : char;
      keys.current = { text, time };
      const repeated = [...text].every(letter => letter === char);
      const query = repeated ? char : text;
      const choices = isTop ? groups.map((group, i) => ({ id: buttonKey(i), label: group.name })) : entries;
      const start = (isTop ? top : index) + 1;
      const rotated = [...choices.slice(start), ...choices.slice(0, start)];
      const result = rotated.find(entry => entry.label.toLocaleLowerCase().startsWith(query));
      if (result) setFocus({ key: result.id });
    } else return;
    event.preventDefault();
    event.stopPropagation();
  }

  function itemList(items: MenuItem[], group: number, nested = false) {
    return <ul className={`applicationMenuList${nested ? " nestedMenuList" : ""}`}
      id={nested ? `${instance}-sub` : `${instance}-items`} aria-label={nested ? parent?.label : t("navigation.menuActions", { menu: groups[group].name })}>
      {items.map(item => {
        const hasChildren = Boolean(item.children?.length);
        const shortcut = item.action && shortcutLabel(item.action.commandId ?? item.action.appAction ?? item.id, platform);
        return <li key={item.id}>
          <button type="button" data-menu-key={item.id} disabled={Boolean(item.disabledReason)} title={item.disabledReason}
            aria-pressed={item.checked} aria-expanded={hasChildren ? sub === item.id : undefined}
            aria-controls={hasChildren && sub === item.id ? `${instance}-sub` : undefined}
            tabIndex={-1} onClick={() => enterItem(item, group)}>
            <span className="menuMark" aria-hidden="true">{item.checked ? "✓" : ""}</span>
            <span className="menuText">{item.label}</span>
            {shortcut && <kbd aria-hidden="true">{shortcut}</kbd>}
            {hasChildren && <span className="menuChevron" aria-hidden="true">›</span>}
          </button>
          {hasChildren && sub === item.id && itemList(item.children!, group, true)}
        </li>;
      })}
    </ul>;
  }

  return <nav ref={nav} className="menuBar desktopMenuBar" aria-label={t("navigation.applicationMenus")}
    onKeyDown={keyboard} onBlur={event => {
      if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) close(false);
    }}>
    {groups.map((group, index) => <div key={group.name} className="applicationMenu">
      <button type="button" data-menu-key={buttonKey(index)} tabIndex={topFocus === index ? 0 : -1}
        aria-expanded={open === index} aria-controls={open === index ? `${instance}-items` : undefined}
        onFocus={() => setTopFocus(index)} onClick={() => open === index ? close(true) : openGroup(index)}>
        {group.name}
      </button>
      {open === index && itemList(group.items, index)}
    </div>)}
  </nav>;
}
