import { Children, useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { shortcutLabel } from "../../commands/keymap";
import type { Beat, MasterBar, Note } from "../../model/types";
import { useLayoutStore } from "../../store/layoutStore";
import { t } from "../i18n/messages.en";
import type { EditorShellProps } from "./EditorShell";

const barSymbolButtons = [
  ["Time", "bar.symbol.timeSignature"],
  ["Key", "bar.symbol.keySignature"],
  ["|:", "bar.symbol.repeatOpen"],
  [":|", "bar.symbol.repeatClose"],
  ["||", "bar.symbol.doubleBar"],
  ["Volta", "bar.symbol.alternateEnding"],
  ["Segno", "bar.symbol.directionTarget"],
  ["D.C.", "bar.symbol.directionJump"],
  ["Ferm.", "bar.symbol.fermata"],
  ["Simile", "bar.symbol.simile"],
  ["Swing", "bar.symbol.tripletFeel"],
  ["Free", "bar.symbol.freeTime"],
  ["Pickup", "bar.symbol.anacrusis"],
  ["Sec.", "bar.symbol.section"]
] as const;
const noteEffectButtons = [
  ["ghost", "note.effect.ghost"],
  ["x", "note.effect.dead"],
  [">", "note.effect.accent"],
  ["^", "note.effect.heavyAccent"],
  ["stac", "note.effect.staccato"],
  ["let", "note.effect.letRing"],
  ["PM", "note.effect.palmMute"],
  ["H/P", "note.effect.hopo"],
  ["slide", "note.effect.slide"],
  ["bend", "note.effect.bend"],
  ["N.H.", "note.effect.harmonic"],
  ["vib", "note.effect.vibrato"],
  ["tr", "note.effect.trill"],
  ["trem", "note.effect.tremoloPicking"],
  ["wah", "note.effect.wah"],
  ["slap", "note.effect.slap"],
  ["pop", "note.effect.pop"],
  ["str", "note.effect.stringNumber"]
] as const;
const beatEffectButtons = [
  ["brush v", "beat.effect.brushDown"],
  ["brush ^", "beat.effect.brushUp"],
  ["arp v", "beat.effect.arpeggioDown"],
  ["arp ^", "beat.effect.arpeggioUp"],
  ["pick v", "beat.effect.pickDown"],
  ["pick ^", "beat.effect.pickUp"],
  ["tap", "beat.effect.tapping"],
  ["bar vib", "beat.effect.barVibrato"],
  ["<", "beat.effect.hairpinCresc"],
  [">", "beat.effect.hairpinDecresc"],
  ["8va", "beat.effect.ottava"]
] as const;

const durations = ["𝅝", "𝅗𝅥", "♩", "♪", "𝅘𝅥𝅯", "𝅘𝅥𝅰", "𝅘𝅥𝅱"].map((glyph, index) =>
  [glyph, `duration.set.${2 ** index}`] as const);
const notationSymbols = [
  ["♯", "note.sharp"], ["♭", "note.flat"], ["♮", "note.natural"],
  ["𝄪", "note.doubleSharp"], ["𝄫", "note.doubleFlat"]
] as const;
const sections = [
  { id: "bar", title: "editor.barSymbols", entries: barSymbolButtons },
  { id: "rhythm", title: "editor.noteSymbols", entries: [
    ...durations, ["𝄽", "note.rest"], ["•", "note.dot"], ["••", "note.doubleDot"],
    ["3", "note.triplet"], ["⌒", "note.tie"]
  ] },
  { id: "note", title: "editor.effectSymbols", entries: noteEffectButtons },
  { id: "beat", title: "editor.beatEffects", entries: beatEffectButtons },
  { id: "notation", title: "editor.notationSymbols", entries: [
    ...notationSymbols,
    ...["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"].map((dynamic, index) =>
      [dynamic, `note.dynamic.${index}`] as const)
  ] }
] as const;

interface PaletteSelection {
  note?: Note;
  beat?: Beat;
  bar?: MasterBar;
}

function applied(command: string, { note, beat, bar }: PaletteSelection): boolean | undefined {
  if (command.startsWith("duration.set.")) return beat?.duration === Number(command.slice(command.lastIndexOf(".") + 1));
  if (command.startsWith("note.dynamic.")) return note?.dynamic === Number(command.slice(command.lastIndexOf(".") + 1));
  switch (command) {
    case "note.rest": return Boolean(beat?.rest);
    case "note.dot": return beat?.dots === 1;
    case "note.doubleDot": return beat?.dots === 2;
    case "note.triplet": return Boolean(beat?.tuplet);
    case "note.tie": return Boolean(note?.tiedFromPrevious);
    case "note.sharp": return note?.accidental === "sharp";
    case "note.flat": return note?.accidental === "flat";
    case "note.natural": return note?.accidental === "natural";
    case "note.doubleSharp": return note?.accidental === "doubleSharp";
    case "note.doubleFlat": return note?.accidental === "doubleFlat";
    case "note.effect.ghost": return Boolean(note?.ghost);
    case "note.effect.dead": return Boolean(note?.deadNote);
    case "note.effect.accent": return note?.accent === "accent";
    case "note.effect.heavyAccent": return note?.accent === "heavy";
    case "note.effect.staccato": return Boolean(note?.staccato);
    case "note.effect.letRing": return Boolean(note?.letRing);
    case "note.effect.palmMute": return Boolean(note?.palmMute);
    case "note.effect.hopo": return Boolean(note?.hopo);
    case "note.effect.slide": return Boolean(note?.slide);
    case "note.effect.bend": return Boolean(note?.bend);
    case "note.effect.harmonic": return Boolean(note?.harmonic);
    case "note.effect.vibrato": return Boolean(note && note.vibrato !== "none");
    case "note.effect.trill": return Boolean(note?.trill);
    case "note.effect.tremoloPicking": return Boolean(note?.tremoloPicking);
    case "note.effect.wah": return Boolean(note?.wah);
    case "note.effect.slap": return Boolean(note?.slap);
    case "note.effect.pop": return Boolean(note?.pop);
    case "note.effect.stringNumber": return Boolean(note?.showStringNumber);
    case "beat.effect.brushDown": return beat?.brush?.direction === "down";
    case "beat.effect.brushUp": return beat?.brush?.direction === "up";
    case "beat.effect.arpeggioDown": return beat?.arpeggio?.direction === "down";
    case "beat.effect.arpeggioUp": return beat?.arpeggio?.direction === "up";
    case "beat.effect.pickDown": return beat?.pickstroke === "down";
    case "beat.effect.pickUp": return beat?.pickstroke === "up";
    case "beat.effect.tapping": return Boolean(beat?.tapping);
    case "beat.effect.barVibrato": return Boolean(beat && beat.barVibrato !== "none");
    case "beat.effect.hairpinCresc": return beat?.dynamicHairpin?.type === "cresc";
    case "beat.effect.hairpinDecresc": return beat?.dynamicHairpin?.type === "decresc";
    case "beat.effect.ottava": return Boolean(beat && beat.ottava !== "none");
    case "bar.symbol.repeatOpen": return Boolean(bar?.repeatOpen);
    case "bar.symbol.repeatClose": return Boolean(bar?.repeatClose);
    case "bar.symbol.doubleBar": return Boolean(bar?.doubleBar);
    case "bar.symbol.alternateEnding": return Boolean(bar?.alternateEndings);
    case "bar.symbol.directionTarget": return Boolean(bar?.directionTargets.length);
    case "bar.symbol.directionJump": return Boolean(bar?.directionJumps.length);
    case "bar.symbol.fermata": return Boolean(bar?.fermatas.length);
    case "bar.symbol.simile": return Boolean(bar && bar.simileMark !== "none");
    case "bar.symbol.tripletFeel": return Boolean(bar?.tripletFeel);
    case "bar.symbol.freeTime": return Boolean(bar?.freeTime);
    case "bar.symbol.anacrusis": return Boolean(bar?.anacrusis);
    case "bar.symbol.section": return Boolean(bar?.section);
    default: return undefined;
  }
}

type PaletteProps = Pick<EditorShellProps,
  "dispatchCommand" | "cursor" | "multiVoiceEdit" | "onVoiceSelect" | "onToggleMultiVoice"
  | "score" | "platform" | "registeredCommands" | "panelVisibility" | "activeToolPanel"
  | "stylesheetPanelOpen" | "onStylesheetPanelOpen" | "onToolOpen" | "togglePanel">;

export function EditionPalette(props: PaletteProps) {
  const scroll = useRef<HTMLElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const pendingScroll = useRef<number | null>(null);
  const { cursor, score } = props;
  const track = score.tracks.find(({ id }) => id === cursor.trackId);
  const beat = track?.bars[cursor.barIndex]?.voices[cursor.voiceIndex]?.beats[cursor.beatIndex];
  const note = beat?.notes.find((candidate) => candidate.string === cursor.string) ?? beat?.notes[0];
  const selection = { beat, note, bar: score.masterBars[cursor.barIndex] };
  useEffect(() => {
    const surface = scroll.current;
    if (surface) surface.scrollTop = useLayoutStore.getState().paletteScroll;
    function saveScroll() {
      clearTimeout(saveTimer.current);
      if (pendingScroll.current !== null) {
        useLayoutStore.getState().setPaletteScroll(pendingScroll.current);
        pendingScroll.current = null;
      }
    }
    window.addEventListener("pagehide", saveScroll);
    return () => {
      window.removeEventListener("pagehide", saveScroll);
      saveScroll();
    };
  }, []);

  const auxiliarySections = [
    { id: "design", label: "Design", glyph: "◫", command: "view.stylesheet", name: "Score stylesheet",
      active: props.stylesheetPanelOpen, activate: props.onStylesheetPanelOpen },
    { id: "lyrics", label: "Lyrics", glyph: "Aa", command: "lyrics", name: "Lyrics editing",
      disabledReason: "Lyrics editing is unavailable" },
    { id: "chords", label: "Chords", glyph: "♮", command: "tools.chords", name: t("toolbar.chordTool"),
      active: props.activeToolPanel === "chords", activate: () => props.onToolOpen("chords") },
    { id: "automation", label: "Automation", glyph: "⌁", command: "panels.automation", name: t("editor.automationEditor"),
      active: props.panelVisibility.automationView, activate: () => props.togglePanel("automationView") }
  ];

  return (
    <aside ref={scroll} className="palettePanel compactPalette" aria-label={t("editor.editionPalette")}
      data-testid="palette-panel" onScroll={(event) => {
        pendingScroll.current = event.currentTarget.scrollTop;
        clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          if (pendingScroll.current !== null) useLayoutStore.getState().setPaletteScroll(pendingScroll.current);
          pendingScroll.current = null;
        }, 75);
      }}>
      <PaletteSection id="voices" label={t("editor.voices")}>
        {[1, 2, 3, 4].map((voice) => (
          <button key={voice} type="button" aria-label={`Voice ${voice} (V${voice})`} aria-pressed={cursor.voiceIndex === voice - 1}
            onClick={() => props.onVoiceSelect(voice - 1)}><span aria-hidden="true">V{voice}</span></button>
        ))}
      </PaletteSection>
      <PaletteSection id="multi" label={t("editor.multivoice")} columns={1}>
        <button type="button" aria-pressed={props.multiVoiceEdit} onClick={props.onToggleMultiVoice}>
          {props.multiVoiceEdit ? t("editor.on") : t("editor.off")}
        </button>
      </PaletteSection>
      {auxiliarySections.map(({ id, label, glyph, command, name, active, activate, disabledReason }) => (
        <PaletteSection key={id} id={id} label={label} defaultExpanded={false}>
          <button type="button" aria-label={glyphLabel(name, glyph)} aria-pressed={active} disabled={Boolean(disabledReason)}
            title={[name, shortcutLabel(command, props.platform), disabledReason].filter(Boolean).join(" · ")}
            onClick={activate}><span aria-hidden="true">{glyph}</span></button>
        </PaletteSection>
      ))}
      {sections.map(({ id, title, entries }) => (
        <PaletteSection key={id} id={id} label={t(title)}>
          {entries.map(([glyph, id]) => {
            const command = props.registeredCommands.find((item) => item.id === id);
            const pressed = applied(id, selection);
            const label = command?.label ?? id;
            const shortcut = shortcutLabel(id, props.platform);
            const disabled = !command || (id.startsWith("note.effect.") && !note) || (id.startsWith("beat.effect.") && !beat);
            return <button key={id} type="button" aria-label={glyphLabel(label, glyph)} aria-pressed={pressed} disabled={disabled}
              title={[label, shortcut, disabled ? "Unavailable at the current position" : pressed ? "Applied" : ""].filter(Boolean).join(" · ")}
              onClick={() => props.dispatchCommand(id)}><span aria-hidden="true">{glyph}</span></button>;
          })}
        </PaletteSection>
      ))}
    </aside>
  );
}

function PaletteSection({ id, label, columns = 4, defaultExpanded = true, children }: {
  id: string; label: string; columns?: number; defaultExpanded?: boolean; children: ReactNode
}) {
  const expanded = useLayoutStore((state) => !(state.paletteCollapsed[id] ?? !defaultExpanded));
  const toggle = useLayoutStore((state) => state.togglePaletteSection);
  const controls = useId();
  return (
    <section className="paletteGroup">
      <h2><button type="button" className="paletteDisclosure" aria-expanded={expanded} aria-controls={controls}
        onClick={() => toggle(id, !defaultExpanded)}><span aria-hidden>{expanded ? "⌄" : "›"}</span>{label}
        <span className="paletteCommandCount" aria-hidden>{Children.count(children)}</span>
      </button></h2>
      {expanded && <div id={controls} className="paletteButtons" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        onKeyDown={(event) => moveInGrid(event, columns)}>{children}</div>}
    </section>
  );
}

function moveInGrid(event: KeyboardEvent<HTMLDivElement>, columns: number) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
  const current = buttons.findIndex((button) => button === event.target);
  if (current < 0) return;
  event.preventDefault();
  const step = event.key === "ArrowUp" ? -columns : event.key === "ArrowDown" ? columns
    : event.key === "ArrowLeft" ? -1 : 1;
  let next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : current + step;
  const increment = event.key === "End" ? -1 : event.key === "Home" ? 1 : step;
  while (buttons[next]?.disabled) next += increment;
  buttons[next]?.focus();
}

function glyphLabel(label: string, glyph: string): string {
  return /[a-z0-9]/i.test(glyph) && !label.toLowerCase().includes(glyph.toLowerCase())
    ? `${label} (${glyph})` : label;
}
