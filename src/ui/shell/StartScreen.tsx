import type { Score } from "../../model/types";
import type { RecentScore } from "../../store/autosave";
import { HomeLibrary } from "../home/HomeLibrary";
import { useState } from "react";
import { INSTRUMENT_DEFINITIONS, TUNING_PRESETS, instrumentById } from "../../model/instruments";
import type { BeatDuration } from "../../model/types";
import { t } from "../i18n/messages.en";

export interface NewScoreOptions {
  instrumentId: string;
  tuningId?: string;
  tempo: number;
  beats: number;
  unit: BeatDuration;
}

export function StartScreen({
  onCreate, onOpen, onRecent, onDemo, hasDocuments, onReturn, onOpenRecent, onOpenLocal, onCreateTemplate
}: {
  onCreate: (options: NewScoreOptions) => void;
  onOpen: () => void;
  onRecent: () => void;
  onDemo: () => void;
  hasDocuments: boolean;
  onReturn: () => void;
  onOpenRecent: (recent: RecentScore) => void;
  onOpenLocal: (file: File) => void;
  onCreateTemplate: (score: Score) => void;
}) {
  const [customizing, setCustomizing] = useState(false);
  const [instrumentId, setInstrument] = useState("guitar");
  const [tuningId, setTuning] = useState("");
  const [tempo, setTempo] = useState(120);
  const [beats, setBeats] = useState(4);
  const [unit, setUnit] = useState<BeatDuration>(4);
  const instrument = instrumentById(instrumentId);
  const tunings = TUNING_PRESETS.filter(({ instrumentIds }) => instrumentIds.includes(instrumentId));

  return <main className="tabScoreHome homeLibrary" aria-labelledby="home-title">
    <header>
      <h1 id="home-title">{t("product")}</h1>
      {hasDocuments && <button type="button" onClick={onReturn}>Return to editor</button>}
    </header>
    {!customizing ? <><div className="tabScoreHomeActions">
      <button type="button" onClick={() => setCustomizing(true)}>{t("newScore")}</button>
      <button type="button" onClick={onOpen}>{t("openFile")}</button>
      <button type="button" onClick={onRecent}>{t("recentFiles")}</button>
      <button type="button" onClick={onDemo}>{t("demo")}</button>
    </div><HomeLibrary onOpenRecent={onOpenRecent} onOpenLocal={onOpenLocal}
      onCreateTemplate={onCreateTemplate} /></> : <form onSubmit={(event) => {
      event.preventDefault();
      onCreate({ instrumentId, tuningId: tuningId || undefined, tempo, beats, unit });
    }}>
      <label>{t("instrument")}
        <select value={instrumentId} onChange={(event) => {
          setInstrument(event.target.value);
          setTuning("");
        }}>
          {INSTRUMENT_DEFINITIONS.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      {instrument.stringed && <label>{t("tuning")}<select value={tuningId} onChange={(event) => setTuning(event.target.value)}>
        <option value="">{instrument.tuningLabel}</option>
        {tunings.map(({ id, name, label }) => <option key={id} value={id}>{name} · {label}</option>)}
      </select></label>}
      <label>{t("tempo")} <input type="number" min={20} max={400} required value={tempo} onChange={(event) => setTempo(Number(event.target.value))} /></label>
      <fieldset><legend>{t("meter")}</legend>
        <label>{t("home.beats")} <input type="number" min={1} max={32} required value={beats} onChange={(event) => setBeats(Number(event.target.value))} /></label>
        <label>{t("home.noteValue")} <select value={unit} onChange={(event) => setUnit(Number(event.target.value) as BeatDuration)}>
          {[1, 2, 4, 8, 16, 32, 64].map((value) => <option key={value}>{value}</option>)}
        </select></label>
      </fieldset>
      <button type="submit">{t("create")}</button>
      <button type="button" onClick={() => setCustomizing(false)}>{t("cancel")}</button>
    </form>}
  </main>;
}
