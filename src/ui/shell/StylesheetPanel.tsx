import { useMemo, useState, type ReactNode } from "react";
import { normalizeStylesheet } from "../../model/stylesheet";
import type {
  BarNumberFrequency,
  DisplayMode,
  HeaderFooterVisibility,
  LyricsPosition,
  PageOrientation,
  Score,
  Stylesheet,
  StylesheetPresetName,
  SymbolStyle,
  TabRhythmPosition,
  TrackNameMode
} from "../../model/types";

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
  const [activeTab, setActiveTab] = useState<TabId>("page");
  const [saved, setSaved] = useState(false);
  const stylesheet = useMemo(() => normalizeStylesheet(props.score.stylesheet), [props.score.stylesheet]);

  if (!props.open) {
    return null;
  }

  function patch<K extends StylesheetSection>(section: K, value: Partial<Stylesheet[K]>): void {
    props.onChange({
      ...stylesheet,
      [section]: {
        ...stylesheet[section],
        ...value
      }
    });
    setSaved(false);
  }

  function saveStyle(): void {
    localStorage.setItem("gp8-clone-saved-stylesheet", JSON.stringify(stylesheet));
    setSaved(true);
  }

  return (
    <section className="stylesheetPanel" aria-label="Score stylesheet">
      <header className="toolPanelHeader">
        <strong>Score Stylesheet</strong>
        <button type="button" onClick={props.onClose} title="Close stylesheet">
          x
        </button>
      </header>
      <nav className="stylesheetTabs" aria-label="Stylesheet tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? "activeToggle" : ""}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="stylesheetBody">
        {activeTab === "page" ? (
          <section className="styleFormGrid">
            <Field label="Paper">
              <select value={stylesheet.page.paper} onChange={(event) => patch("page", { paper: event.target.value })}>
                {["A4", "Letter", "Legal", "A3", "Custom"].map((paper) => (
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
            <NumberField label="Width" value={stylesheet.page.width} min={420} max={1800} onChange={(width) => patch("page", { width })} />
            <NumberField label="Height" value={stylesheet.page.height} min={420} max={2200} onChange={(height) => patch("page", { height })} />
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
            <Field label="Track names">
              <select
                value={stylesheet.systems.showTrackNames}
                onChange={(event) => patch("systems", { showTrackNames: event.target.value as TrackNameMode })}
              >
                <option value="none">None</option>
                <option value="firstSystem">First system</option>
                <option value="everySystem">Every system</option>
              </select>
            </Field>
            <ToggleField label="Use short names" checked={stylesheet.systems.useShortNames} onChange={(useShortNames) => patch("systems", { useShortNames })} />
            <ToggleField label="Tuning notice" checked={stylesheet.systems.tuningNotice} onChange={(tuningNotice) => patch("systems", { tuningNotice })} />
            <ToggleField label="Capo affects notation" checked={stylesheet.systems.capoShiftAffectsNotation} onChange={(capoShiftAffectsNotation) => patch("systems", { capoShiftAffectsNotation })} />
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
            <TextField label="Chord font" value={stylesheet.texts.chordFont} onChange={(chordFont) => patch("texts", { chordFont })} />
            <NumberField label="Chord size" value={stylesheet.texts.chordSize} min={8} max={22} onChange={(chordSize) => patch("texts", { chordSize })} />
            <TextField label="Lyrics font" value={stylesheet.texts.lyricsFont} onChange={(lyricsFont) => patch("texts", { lyricsFont })} />
            <NumberField label="Lyrics size" value={stylesheet.texts.lyricsSize} min={8} max={18} onChange={(lyricsSize) => patch("texts", { lyricsSize })} />
            <Field label="Lyrics position">
              <select
                value={stylesheet.texts.lyricsPosition}
                onChange={(event) => patch("texts", { lyricsPosition: event.target.value as LyricsPosition })}
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
              </select>
            </Field>
            <Field label="Bar numbers">
              <select
                value={stylesheet.texts.barNumberFrequency}
                onChange={(event) => patch("texts", { barNumberFrequency: event.target.value as BarNumberFrequency })}
              >
                <option value="none">None</option>
                <option value="everySystem">Every system</option>
                <option value="everyBar">Every bar</option>
              </select>
            </Field>
            <NumberField label="Section size" value={stylesheet.texts.sectionFontSize} min={8} max={20} onChange={(sectionFontSize) => patch("texts", { sectionFontSize })} />
            <NumberField label="Dynamic size" value={stylesheet.texts.dynamicFontSize} min={8} max={20} onChange={(dynamicFontSize) => patch("texts", { dynamicFontSize })} />
          </section>
        ) : null}

        {activeTab === "notation" ? (
          <section className="styleFormGrid">
            <ToggleField label="Common time C" checked={stylesheet.notation.replaceCommonTime} onChange={(replaceCommonTime) => patch("notation", { replaceCommonTime })} />
            <ToggleField label="Cut time C" checked={stylesheet.notation.replaceCutTime} onChange={(replaceCutTime) => patch("notation", { replaceCutTime })} />
            <ToggleField label="Tab rhythm" checked={stylesheet.notation.showTabRhythm} onChange={(showTabRhythm) => patch("notation", { showTabRhythm })} />
            <ToggleField label="Color tab voices" checked={stylesheet.notation.colorizeTabVoices} onChange={(colorizeTabVoices) => patch("notation", { colorizeTabVoices })} />
            <TabRhythmField label="Voice 1 rhythm" value={stylesheet.notation.tabRhythmPositionVoice1} onChange={(tabRhythmPositionVoice1) => patch("notation", { tabRhythmPositionVoice1 })} />
            <TabRhythmField label="Voice 2 rhythm" value={stylesheet.notation.tabRhythmPositionVoice2} onChange={(tabRhythmPositionVoice2) => patch("notation", { tabRhythmPositionVoice2 })} />
            <TabRhythmField label="Voice 3 rhythm" value={stylesheet.notation.tabRhythmPositionVoice3} onChange={(tabRhythmPositionVoice3) => patch("notation", { tabRhythmPositionVoice3 })} />
            <TabRhythmField label="Voice 4 rhythm" value={stylesheet.notation.tabRhythmPositionVoice4} onChange={(tabRhythmPositionVoice4) => patch("notation", { tabRhythmPositionVoice4 })} />
            <Field label="Symbol style">
              <select
                value={stylesheet.symbols.style}
                onChange={(event) => patch("symbols", { style: event.target.value as SymbolStyle })}
              >
                <option value="Classic">Classic</option>
                <option value="Jazz">Jazz</option>
              </select>
            </Field>
            <ColorField label="Symbol color" value={stylesheet.symbols.textColor} onChange={(textColor) => patch("symbols", { textColor })} />
            <TextField label="Palm mute" value={stylesheet.symbols.palmMuteText} onChange={(palmMuteText) => patch("symbols", { palmMuteText })} />
            <TextField label="Let ring" value={stylesheet.symbols.letRingText} onChange={(letRingText) => patch("symbols", { letRingText })} />
            <NumberField label="Scale spacing" value={stylesheet.symbols.scaleDiagramSpacing} min={8} max={36} onChange={(scaleDiagramSpacing) => patch("symbols", { scaleDiagramSpacing })} />
            <ToggleField label="Extend lines" checked={stylesheet.symbols.extendLinesOverRests} onChange={(extendLinesOverRests) => patch("symbols", { extendLinesOverRests })} />
            <ToggleField label="Show dynamics" checked={stylesheet.symbols.showDynamics} onChange={(showDynamics) => patch("symbols", { showDynamics })} />
            <ToggleField label="Show directions" checked={stylesheet.symbols.showDirections} onChange={(showDirections) => patch("symbols", { showDirections })} />
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
                  onClick={() => props.onPreset(preset)}
                >
                  {preset}
                </button>
              ))}
            </div>
            <button type="button" onClick={saveStyle}>
              {saved ? "Style saved" : "Save style"}
            </button>
            <Field label="Display mode">
              <select
                value={props.score.documentSettings.displayMode}
                onChange={(event) => props.onDisplayModeChange(event.target.value as DisplayMode)}
              >
                {displayModes.map(([mode, label]) => (
                  <option key={mode} value={mode}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <NumberField label="Zoom" value={props.score.documentSettings.zoom} min={25} max={300} onChange={props.onZoomChange} />
            <ToggleField label="Chord names" checked={stylesheet.symbols.showChordNames} onChange={(showChordNames) => patch("symbols", { showChordNames })} />
            <ToggleField label="Chord diagrams" checked={stylesheet.symbols.showChordDiagrams} onChange={(showChordDiagrams) => patch("symbols", { showChordDiagrams })} />
            <NumberField label="Chord scale" value={stylesheet.symbols.chordDiagramScale} min={0.6} max={1.8} step={0.05} onChange={(chordDiagramScale) => patch("symbols", { chordDiagramScale })} />
            <NumberField label="Chord spacing" value={stylesheet.symbols.chordDiagramSpacing} min={8} max={48} onChange={(chordDiagramSpacing) => patch("symbols", { chordDiagramSpacing })} />
          </section>
        ) : null}
      </div>
    </section>
  );
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
  return (
    <Field label={label}>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
      />
    </Field>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <Field label={label}>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </Field>
  );
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

function TabRhythmField({ label, value, onChange }: { label: string; value: TabRhythmPosition; onChange: (value: TabRhythmPosition) => void }) {
  return (
    <Field label={label}>
      <select value={value} onChange={(event) => onChange(event.target.value as TabRhythmPosition)}>
        <option value="above">Above</option>
        <option value="below">Below</option>
        <option value="hidden">Hidden</option>
      </select>
    </Field>
  );
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
