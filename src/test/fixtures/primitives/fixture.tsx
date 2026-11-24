import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AppIcon,
  Dialog,
  IconButton,
  Menu,
  MenuItem,
  MenuSeparator,
  Popover,
  SegmentedControl,
  SplitterHandle,
  Submenu,
  Tabs,
  ToolbarButton
} from "../../../ui/components";
import "../../../ui/styles/index.css";

function Fixture() {
  const [dialog, setDialog] = useState(false),
    [menu, setMenu] = useState(false),
    [tool, setTool] = useState("pencil");
  const [tab, setTab] = useState("score"),
    [width, setWidth] = useState(20),
    [action, setAction] = useState("");
  const anchor = useRef<HTMLButtonElement>(null);
  const tabs = [
    { value: "score", label: "Score", content: "Notation" },
    { value: "mix", label: "Mix", content: "Track levels" }
  ];
  return (
    <main>
      <h1>TabScore controls</h1>
      <AppIcon name="home" decorative={false} label="Home symbol" />
      <IconButton label="Inspect" icon="inspector" pressed size="xs" shortcut="F6" />
      <IconButton label="Delete" icon="close" danger disabled size="md" />
      <ToolbarButton label="Tuner" icon="tuner" commandId="tools.tuner" dispatch={setAction} />
      <button onClick={() => setDialog(true)}>Open dialog</button>
      <Dialog
        open={dialog}
        title="Score properties"
        description="Set the score properties."
        onClose={() => setDialog(false)}
      >
        <button>First</button>
        <button onClick={() => setDialog(false)}>Close</button>
      </Dialog>
      <button ref={anchor} onClick={() => setMenu(!menu)} aria-expanded={menu}>
        Actions
      </button>
      <Popover open={menu} label="Actions list" anchor={anchor} onClose={() => setMenu(false)}>
        <Menu
          label="Actions"
          onClose={() => {
            setMenu(false);
            anchor.current?.focus();
          }}
        >
          <MenuItem checked onClick={() => setAction("grid")}>
            Grid
          </MenuItem>
          <MenuItem disabled>Disabled</MenuItem>
          <MenuSeparator />
          <Submenu label="More">
            <MenuItem onClick={() => setAction("print")}>Print</MenuItem>
          </Submenu>
          <MenuItem shortcut="Ctrl+S" onClick={() => setAction("save")}>
            Save
          </MenuItem>
        </Menu>
      </Popover>
      <Tabs label="Panels" items={tabs} value={tab} onChange={setTab} activation="manual" />
      <SegmentedControl
        label="Tool"
        items={[
          { value: "pencil", label: "Pencil" },
          { value: "select", label: "Select" }
        ]}
        value={tool}
        onChange={setTool}
      />
      <SplitterHandle
        label="Panel size"
        orientation="vertical"
        value={width}
        min={10}
        max={80}
        onResize={setWidth}
      />
      <output>{action}</output>
    </main>
  );
}
createRoot(document.getElementById("fixture")!).render(<Fixture />);
