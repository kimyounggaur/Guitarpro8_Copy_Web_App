import { layoutScore } from "../../engine/layout/layoutScore";
import { SvgRenderer } from "../../engine/render/SvgRenderer";
import { FileDialog } from "../overlays/FileDialog";
import { EditorWindow } from "../overlays/EditorWindow";
import { useDocumentStore } from "../../store/documentStore";
import { useViewStore } from "../../store/viewStore";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePreferencesStore } from "../../store/preferencesStore";
import { applyStylePreset, normalizeStylesheet, PAPER_SIZES, withPaperSize } from "../../model/stylesheet";
import type { DisplayMode, HeaderFooterVisibility, PageOrientation, Score, Stylesheet, StylesheetPresetName } from "../../model/types";

export interface StylesheetPanelProps {
  open: boolean;
  score: Score;
  onClose: () => void;
  onChange: (stylesheet: Stylesheet) => void;
  onPreset: (presetName: StylesheetPresetName) => void;
  onDisplayModeChange: (mode: DisplayMode) => void;
  onZoomChange: (zoom: number) => void;
}

type TabId = "page" | "systems" | "header" | "texts" | "notation" | "options";
type StylesheetSection = Exclude<keyof Stylesheet, "presetName">;

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "page", label: "Page" },
  { id: "systems", label: "Systems" },
  { id: "header", label: "Header" },
  { id: "texts", label: "Texts" },
  { id: "notation", label: "Notation" },
  { id: "options", label: "Options" }
];

const displayModes: Array<[DisplayMode, string]> = [
  ["vertical-page", "Vertical Page"],
  ["horizontal-page", "Horizontal Page"],
  ["grid", "Grid"],
  ["parchment", "Parchment"],
  ["vertical-screen", "Vertical Screen"],
  ["horizontal-screen", "Horizontal Screen"]
];

export function StylesheetPanel(props: StylesheetPanelProps) {
  const zoom = useViewStore((state) => state.zoom);
  const displayMode = useViewStore((state) => state.displayMode);
  const [activeTab, setActiveTab] = useState<TabId>("page");
  const [saveStatus, setSaveStatus] = useState("");
  const savedStyle = useMemo(() => normalizeStylesheet(props.score.stylesheet), [props.score.stylesheet]);

  const [draft, setDraft] = useState<Stylesheet | null>(null);
  const [confirmClose, setConfirmClose] = useState<"window" | "preview" | null>(null);
  const documentId = useDocumentStore((state) => state.activeId);
  useEffect(() => { setDraft(null); setConfirmClose(null); }, [documentId]);
  const stylesheet = draft ?? savedStyle;
  const dirtyDraft = draft !== null && JSON.stringify(draft) !== JSON.stringify(savedStyle);
  useEffect(() => { if (!props.open) { setDraft(null); setConfirmClose(null); } }, [props.open]);
  function close() {
    if (dirtyDraft) setConfirmClose("window");
    else props.onClose();
  }
  function apply() {
    if (draft && dirtyDraft) props.onChange(draft);
    setDraft(null);
  }
  if (!props.open) {
    return null;
  }

  function patch<K extends StylesheetSection>(section: K, value: Partial<Stylesheet[K]>): void {
    const change = draft ? setDraft : props.onChange;
    change({
      ...stylesheet,
      [section]: {
        ...stylesheet[section],
        ...value
      }
    });
    setSaveStatus("");
  }

  function saveStyle(): void {
    const saved = usePreferencesStore.getState().setDefaultStylesheet(stylesheet);
    setSaveStatus(saved ? "Default style saved" : "Default style available for this session");
  }

  return (
    <EditorWindow regionLabel="Score stylesheet" kind="style" id="style" modal={false} title="Score Stylesheet" closeLabel="Close stylesheet" description="Change the layout and notation of the current score." onClose={close}>
    <section className="stylesheetPanel">
      <nav className="stylesheetTabs" aria-label="Stylesheet tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={activeTab === tab.id}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
              event.preventDefault();
              const next = (tabs.indexOf(tab) + (event.key === "ArrowLeft" ? -1 : 1) + tabs.length) % tabs.length;
              setActiveTab(tabs[next].id);
              event.currentTarget.parentElement?.querySelectorAll("button")[next]?.focus();
            }}
            className={activeTab === tab.id ? "activeToggle" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="styleEditBody">
      <div className="stylesheetBody">
        {activeTab === "page" ? (
          <section className="styleFormGrid">
            <Field label="Paper">
              <select value={stylesheet.page.paper} onChange={(event) => patch("page", withPaperSize(stylesheet.page, event.target.value))}>
                {[...Object.keys(PAPER_SIZES), "Custom"].map((paper) => (
                  <option key={paper} value={paper}>
                    {paper}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Orientation">
              <select
                value={stylesheet.page.orientation}
                onChange={(event) => patch("page", { orientation: event.target.value as PageOrientation })}
              >
                <option value="portrait">Portrait</option>
                <option value="landscape">Landscape</option>
              </select>
            </Field>
            <NumberField label="Width" value={stylesheet.page.width} min={420} max={1800} onChange={(width) => patch("page", { paper: "Custom", width })} />
            <NumberField label="Height" value={stylesheet.page.height} min={420} max={2200} onChange={(height) => patch("page", { paper: "Custom", height })} />
            <NumberField label="Left margin" value={stylesheet.page.marginLeft} min={18} max={220} onChange={(marginLeft) => patch("page", { marginLeft })} />
            <NumberField label="Right margin" value={stylesheet.page.marginRight} min={18} max={220} onChange={(marginRight) => patch("page", { marginRight })} />
            <NumberField label="Top margin" value={stylesheet.page.marginTop} min={28} max={240} onChange={(marginTop) => patch("page", { marginTop })} />
            <NumberField label="Bottom margin" value={stylesheet.page.marginBottom} min={28} max={240} onChange={(marginBottom) => patch("page", { marginBottom })} />
            <ColorField label="Page fill" value={stylesheet.page.pageFill} onChange={(pageFill) => patch("page", { pageFill })} />
            <ColorField label="Page stroke" value={stylesheet.page.pageStroke} onChange={(pageStroke) => patch("page", { pageStroke })} />
            <NumberField label="Rhythm spacing" value={stylesheet.page.rhythmProportion} min={0.7} max={1.5} step={0.01} onChange={(rhythmProportion) => patch("page", { rhythmProportion })} />
            <NumberField label="Min measure" value={stylesheet.page.minMeasureWidth} min={60} max={180} onChange={(minMeasureWidth) => patch("page", { minMeasureWidth })} />
          </section>
        ) : null}

        {activeTab === "systems" ? (
          <section className="styleFormGrid">
            <NumberField label="System gap" value={stylesheet.systems.systemGap} min={12} max={96} onChange={(systemGap) => patch("systems", { systemGap })} />
            <NumberField label="Track gap" value={stylesheet.systems.trackGap} min={10} max={80} onChange={(trackGap) => patch("systems", { trackGap })} />
            <ColorField label="Staff color" value={stylesheet.systems.staffLineColor} onChange={(staffLineColor) => patch("systems", { staffLineColor })} />
            <NumberField label="Staff thickness" value={stylesheet.systems.staffLineThickness} min={0.5} max={3} step={0.05} onChange={(staffLineThickness) => patch("systems", { staffLineThickness })} />
            <ColorField label="Barline color" value={stylesheet.systems.barlineColor} onChange={(barlineColor) => patch("systems", { barlineColor })} />
            <NumberField label="Barline thickness" value={stylesheet.systems.barlineThickness} min={0.5} max={3} step={0.05} onChange={(barlineThickness) => patch("systems", { barlineThickness })} />
          </section>
        ) : null}

        {activeTab === "header" ? (
          <section className="styleFormGrid wideStyleGrid">
            <Field label="Header">
              <select
                value={stylesheet.headerFooter.headerVisibility}
                onChange={(event) => patch("headerFooter", { headerVisibility: event.target.value as HeaderFooterVisibility })}
              >
                <option value="never">Never</option>
                <option value="firstPage">First page</option>
                <option value="everyPage">Every page</option>
              </select>
            </Field>
            <Field label="Footer">
              <select
                value={stylesheet.headerFooter.footerVisibility}
                onChange={(event) => patch("headerFooter", { footerVisibility: event.target.value as HeaderFooterVisibility })}
              >
                <option value="never">Never</option>
                <option value="firstPage">First page</option>
                <option value="everyPage">Every page</option>
              </select>
            </Field>
            <TextField label="Title" value={stylesheet.headerFooter.firstPageTitle} onChange={(firstPageTitle) => patch("headerFooter", { firstPageTitle })} />
            <TextField label="Subtitle" value={stylesheet.headerFooter.firstPageSubtitle} onChange={(firstPageSubtitle) => patch("headerFooter", { firstPageSubtitle })} />
            <TextField label="Left header" value={stylesheet.headerFooter.leftHeader} onChange={(leftHeader) => patch("headerFooter", { leftHeader })} />
            <TextField label="Center header" value={stylesheet.headerFooter.centerHeader} onChange={(centerHeader) => patch("headerFooter", { centerHeader })} />
            <TextField label="Right header" value={stylesheet.headerFooter.rightHeader} onChange={(rightHeader) => patch("headerFooter", { rightHeader })} />
            <TextField label="Left footer" value={stylesheet.headerFooter.leftFooter} onChange={(leftFooter) => patch("headerFooter", { leftFooter })} />
            <TextField label="Center footer" value={stylesheet.headerFooter.centerFooter} onChange={(centerFooter) => patch("headerFooter", { centerFooter })} />
            <TextField label="Right footer" value={stylesheet.headerFooter.rightFooter} onChange={(rightFooter) => patch("headerFooter", { rightFooter })} />
            <ToggleField label="Page numbers" checked={stylesheet.headerFooter.showPageNumbers} onChange={(showPageNumbers) => patch("headerFooter", { showPageNumbers })} />
            <ToggleField label="Copyright" checked={stylesheet.headerFooter.showCopyright} onChange={(showCopyright) => patch("headerFooter", { showCopyright })} />
          </section>
        ) : null}

        {activeTab === "texts" ? (
          <section className="styleFormGrid">
            <TextField label="Title font" value={stylesheet.texts.titleFont} onChange={(titleFont) => patch("texts", { titleFont })} />
            <NumberField label="Title size" value={stylesheet.texts.titleSize} min={12} max={34} onChange={(titleSize) => patch("texts", { titleSize })} />
            <TextField label="Body font" value={stylesheet.texts.bodyFont} onChange={(bodyFont) => patch("texts", { bodyFont })} />
            <NumberField label="Body size" value={stylesheet.texts.bodySize} min={8} max={18} onChange={(bodySize) => patch("texts", { bodySize })} />
          </section>
        ) : null}

        {activeTab === "notation" ? (
          <section className="styleFormGrid">
            <ToggleField label="Common time C" checked={stylesheet.notation.replaceCommonTime} onChange={(replaceCommonTime) => patch("notation", { replaceCommonTime })} />
            <ToggleField label="Cut time C" checked={stylesheet.notation.replaceCutTime} onChange={(replaceCutTime) => patch("notation", { replaceCutTime })} />
            <ToggleField label="Tab rhythm" checked={stylesheet.notation.showTabRhythm} onChange={(showTabRhythm) => patch("notation", { showTabRhythm })} />
            <ColorField label="Score text color" value={stylesheet.symbols.textColor} onChange={(textColor) => patch("symbols", { textColor })} />
          </section>
        ) : null}

        {activeTab === "options" ? (
          <section className="styleFormGrid">
            <div className="presetButtons">
              {(["Classic", "Jazz", "Rock"] as StylesheetPresetName[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={stylesheet.presetName === preset ? "activeToggle" : ""}
                  onClick={() => draft ? setDraft(applyStylePreset(draft, preset)) : props.onPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <button type="button" onClick={saveStyle}>
              Save style
            </button>
            {saveStatus ? <span role="status">{saveStatus}</span> : null}
            <Field label="Display mode">
              <select
                value={displayMode}
                onChange={(event) => props.onDisplayModeChange(event.target.value as DisplayMode)}
              >
                {displayModes.map(([mode, label]) => (
                  <option key={mode} value={mode}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <NumberField label="Zoom" value={zoom} min={25} max={300} onChange={props.onZoomChange} />
          </section>
        ) : null}
      </div>
      {draft && <StylePreview score={props.score} draft={draft} />}
      </div>
      <footer className="styleEditBar">
        {draft ? <>
          <button type="button" onClick={apply}>Apply</button>
          <button type="button" onClick={() => setDraft(savedStyle)} disabled={!dirtyDraft}>Reset draft</button>
          <button type="button" onClick={() => dirtyDraft ? setConfirmClose("preview") : setDraft(null)}>Close preview</button>
        </> : <button type="button" onClick={() => setDraft(savedStyle)}>Preview changes</button>}
      </footer>
      {confirmClose && <FileDialog title="Unapplied stylesheet changes" onCancel={() => setConfirmClose(null)}>
        <p>Apply this preview to the score before closing?</p>
        <div className="fileDecisionActions">
          <button type="button" onClick={() => { apply(); setConfirmClose(null); if (confirmClose === "window") props.onClose(); }}>Apply and close</button>
          <button type="button" onClick={() => { setDraft(null); setConfirmClose(null); if (confirmClose === "window") props.onClose(); }}>Discard and close</button>
          <button type="button" onClick={() => setConfirmClose(null)}>Cancel</button>
        </div>
      </FileDialog>}
    </section>
    </EditorWindow>
  );
}

function StylePreview({score, draft}: {score: Score; draft: Stylesheet}) {
  const scene = useMemo(() => {
    const sample = { ...score, stylesheet: draft, masterBars: score.masterBars.slice(0, 4),
      tracks: score.tracks.slice(0, 2).map((track) => ({...track, bars: track.bars.slice(0, 4)})) };
    const result = layoutScore(sample);
    return { ...result, pages: result.pages.slice(0, 1).map((page) => ({...page, id: "style-preview-" + page.id,
      primitives: page.primitives.map((item) => ({...item, id: "style-preview-" + item.id}))})) };
  }, [score, draft]);
  return <aside className="styleScorePreview" aria-label="Stylesheet preview">
    <SvgRenderer scene={scene} displayMode="vertical-page" zoom={25} />
  </aside>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="styleField">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return <DraftField label={label} value={String(value)} type="number" min={min} max={max} step={step}
    onCommit={(input) => { if (input && Number.isFinite(Number(input))) onChange(clamp(Number(input), min, max)); }} />;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <DraftField label={label} value={value} type="text" onCommit={onChange} />;
}

function DraftField({ label, value, type, min, max, step, onCommit }: {
  label: string; value: string; type: "text" | "number"; min?: number; max?: number; step?: number; onCommit: (value: string) => void;
}) {
  const [text, setText] = useState(value);
  const editing = useRef(false);
  useEffect(() => { if (!editing.current) setText(value); }, [value]);
  return <Field label={label}><input type={type} value={text} min={min} max={max} step={step}
    onFocus={() => { editing.current = true; }} onChange={(event) => setText(event.target.value)}
    onBlur={(event) => {
      editing.current = false;
      if (text !== value && (type === "text" || (text && event.currentTarget.validity.valid))) onCommit(text);
      else setText(value);
    }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} /></Field>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <input type="color" value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
}

function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="styleCheck">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
