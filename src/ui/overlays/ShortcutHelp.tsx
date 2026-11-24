import { useMemo, useState } from "react";
import { KEYMAP_ENTRIES, detectPlatform } from "../../commands/keymap";
import { MENU_TREE } from "../../commands/paletteCommands";
import { EditorWindow } from "./EditorWindow";

const menuPaths = new Map(MENU_TREE.flatMap(({ name, actions }) =>
  actions.map((item) => [item.commandId ?? item.appAction ?? item.id, name + " › " + item.label] as const)
));

export function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState("");
  const platform = detectPlatform();
  const rows = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return KEYMAP_ENTRIES.filter((entry) => entry[platform].length > 0).map((entry) => ({
      id: entry.commandId,
      label: entry.label,
      group: menuPaths.get(entry.commandId) ?? entry.category,
      scope: entry.scope,
      keys: entry[platform].join(" / ")
    })).filter((item) => Object.values(item).join(" ").toLowerCase().includes(query));
  }, [platform, filter]);

  return <EditorWindow kind="help" id="shortcuts" title="Keyboard shortcuts" regionLabel="Shortcut reference" modal
    description="Find a shortcut by command, menu, key, or scope." closeLabel="Close keyboard shortcuts" onClose={onClose}>
    <section className="shortcutHelp">
      <label>Find a shortcut<input type="search" value={filter} placeholder="Command, key, or menu"
        onChange={(event) => setFilter(event.target.value)} /></label>
      <div className="shortcutTable"><table><thead><tr><th>Command</th><th>Menu or category</th><th>Scope</th><th>Shortcut</th></tr></thead>
        <tbody>{rows.map((item) => <tr key={item.id + item.scope}>
          <th scope="row">{item.label}</th><td>{item.group}</td><td>{item.scope}</td><td><kbd>{item.keys}</kbd></td>
        </tr>)}</tbody></table>
        {!rows.length && <p role="status">No matching shortcuts.</p>}
      </div>
    </section>
  </EditorWindow>;
}
