import { useEffect, useMemo, useRef, useState } from "react";
import { layoutScore } from "../../engine/layout/layoutScore";
import { SvgRenderer } from "../../engine/render/SvgRenderer";
import { readScoreFile } from "../../io/fileFormat";
import { createBeat, createEmptyScore, createNote, createTrack } from "../../model/factory";
import { instrumentById } from "../../model/instruments";
import type { Score } from "../../model/types";
import { clearRecentScores, listRecentScores, setRecentScorePin, type RecentScore } from "../../store/autosave";

type Category = "Recent" | "Local" | "Library" | "Templates" | "Examples";
const categories: Category[] = ["Recent", "Local", "Library", "Templates", "Examples"];
type Entry = {
  id: string;
  category: Category;
  title: string;
  artist?: string;
  fileName?: string;
  source: string;
  recent?: RecentScore;
  file?: File;
  makeScore?: () => Score;
};

type Directory = { values: () => AsyncIterable<{ kind: "file" | "directory"; getFile?: () => Promise<File> }> };
function template(instrumentId: string): Score {
  const score = createEmptyScore();
  const instrument = instrumentById(instrumentId);
  score.meta.title = instrument.name;
  score.tracks.push(createTrack({ ...instrument, strings: [...instrument.tuning] }));
  return score;
}

const fixedEntries: Entry[] = [
  { id: "guitar", category: "Templates", title: "Solo guitar", source: "Template", makeScore: () => template("guitar") },
  { id: "bass", category: "Templates", title: "Solo bass", source: "Template", makeScore: () => template("bass") },
  { id: "piano", category: "Templates", title: "Piano sketch", source: "Template", makeScore: () => template("piano") },
  {
    id: "warmup", category: "Examples", title: "Four-note warm-up", source: "TabScore example",
    makeScore: () => {
      const score = template("guitar");
      score.meta.title = "Four-note warm-up";
      score.tracks[0].bars[0].voices[0].beats = [0, 2, 4, 5].map((fret) =>
        createBeat({ rest: false, notes: [createNote(1, fret)] }));
      return score;
    }
  }
];

function previewFor(entry: Entry): Promise<Score> {
  if (entry.makeScore) return Promise.resolve(entry.makeScore());
  if (entry.recent) return Promise.resolve().then(() => readScoreFile(entry.recent!.payload).score);
  return entry.file!.text().then((text) => readScoreFile(text).score);
}

export function HomeLibrary({ onOpenRecent, onOpenLocal, onCreateTemplate }: {
  onOpenRecent: (record: RecentScore) => void;
  onOpenLocal: (file: File) => void;
  onCreateTemplate: (score: Score) => void;
}) {
  const [category, setCategory] = useState<Category>("Recent");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<RecentScore[] | null>(null);
  const [local, setLocal] = useState<File[]>([]);
  const [activeId, setActiveId] = useState("");
  const [status, setStatus] = useState("");
  const [preview, setPreview] = useState<{ id: string; score?: Score; error?: string }>();
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let current = true;
    void listRecentScores().then((records) => {
      if (current) setRecent(records);
    }, () => {
      if (current) {
        setRecent([]);
        setStatus("The browser could not load recent files.");
      }
    });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim().toLowerCase()), 150);
    return () => window.clearTimeout(timer);
  }, [search]);

  const entries = useMemo<Entry[]>(() => [
    ...(recent ?? []).slice().sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastOpened.localeCompare(a.lastOpened)).map((record): Entry => ({
      id: record.id, category: "Recent", title: record.title, artist: record.artist, fileName: record.fileName,
      source: record.source, recent: record
    })),
    ...local.map((file, index): Entry => ({
      id: `local-${index}`, category: "Local", title: file.name, file, source: "Device"
    })),
    ...fixedEntries
  ].filter((entry) => `${entry.title} ${entry.artist ?? ""} ${entry.fileName ?? ""}`.toLowerCase().includes(query)), [recent, local, query]);

  const results = entries.filter((entry) => entry.category === category);
  const current = results.find(({ id }) => id === activeId) ?? results[0];

  useEffect(() => {
    if (!current) return;
    let present = true;
    void previewFor(current).then((score) => {
      if (present) setPreview({ id: current.id, score });
    }, () => {
      if (present) setPreview({ id: current.id, error: "A preview is unavailable for this file." });
    });
    return () => { present = false; };
  }, [current]);

  const currentPreview = preview && preview.id === current?.id ? preview : undefined;
  const scene = useMemo(() => {
    if (!currentPreview?.score) return null;
    const score = currentPreview.score;
    const count = 12;
    const layout = layoutScore({
      ...score,
      masterBars: score.masterBars.slice(0, count),
      tracks: score.tracks.map((track) => ({ ...track, bars: track.bars.slice(0, count) }))
    });
    return { ...layout, pages: layout.pages.slice(0, 1) };
  }, [currentPreview?.score]);

  async function chooseLocal(): Promise<void> {
    setCategory("Local");
    const picker = (window as Window & { showDirectoryPicker?: () => Promise<Directory> }).showDirectoryPicker;
    if (!picker) return input.current?.click();
    setStatus("Opening the local folder…");
    try {
      const directory = await picker.call(window);
      const items: File[] = [];
      for await (const handle of directory.values()) {
        if (handle.kind === "file" && handle.getFile) {
          const file = await handle.getFile();
          if (/\.(?:tabscore|tscore|json|gp|musicxml|mxl|mid|midi|txt|tab|xml)$/i.test(file.name)) items.push(file);
        }
      }
      setLocal(items);
      setStatus("");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") { setStatus(""); return; }
      setStatus("Folder access was unavailable. Choose local files instead.");
      input.current?.click();
    }
  }

  async function pin(record: RecentScore): Promise<void> {
    try {
      await setRecentScorePin(record.id, !record.pinned);
      setRecent(await listRecentScores());
    } catch { setStatus("The browser could not save this pin."); }
  }

  async function clear(): Promise<void> {
    try {
      await clearRecentScores();
      setRecent([]);
    } catch { setStatus("The browser could not clear recent files."); }
  }

  function open(entry: Entry): void {
    if (entry.recent) onOpenRecent(entry.recent);
    else if (entry.file) onOpenLocal(entry.file);
    else if (entry.makeScore) onCreateTemplate(entry.makeScore());
  }

  return <>
    <label className="homeSearch">Search scores
      <input type="search" value={search} placeholder="Title, artist or file name" onChange={(event) => setSearch(event.target.value)} />
    </label>
    <nav className="homeCategories" aria-label="Score library categories">
      {categories.map((name) => <button type="button" key={name} aria-pressed={name === category}
        onClick={() => { setCategory(name); setActiveId(""); }}>
        {name}<span className="homeCount">{entries.filter((entry) => entry.category === name).length}</span>
      </button>)}
    </nav>
    <div className="homeLibraryGrid">
      <section className="homeLibraryList" aria-label={`${category} scores`}>
        {category === "Recent" && !!recent?.length && <button type="button" onClick={() => void clear()}>Clear recent files</button>}
        {category === "Local" && <button type="button" onClick={() => void chooseLocal()}>Choose local files</button>}
        {category === "Recent" && recent === null ? <p>Loading recent files…</p> :
          results.length === 0 ? <p>{category === "Library" ? "No online catalog is connected." : "No matching scores."}</p> : null}
        {results.map((entry) => <div key={entry.id}>
          <button type="button" className="homeListItem" aria-pressed={entry.id === current?.id}
            onClick={() => setActiveId(entry.id)} onDoubleClick={() => open(entry)}>
            <strong>{entry.title}</strong>
            <small>{[entry.artist, entry.source, entry.recent && new Date(entry.recent.lastOpened).toLocaleDateString()].filter(Boolean).join(" · ")}</small>
          </button>
          {entry.recent && <button type="button" aria-label={`${entry.recent.pinned ? "Unpin" : "Pin"} ${entry.title}`}
            onClick={() => { if (entry.recent) void pin(entry.recent); }}>{entry.recent.pinned ? "Unpin" : "Pin"}</button>}
        </div>)}
      </section>
      <section className="homePreview" aria-label="Score preview">
        {current && <>
          <h2>{current.title}</h2>
          <button type="button" onClick={() => open(current)}>{current.category === "Templates" ? "New from template" : "Open selected score"}</button>
          {scene && <div className="homeThumbnail"><SvgRenderer scene={scene} displayMode="vertical-page" zoom={42} /></div>}
          {currentPreview?.error ? <p>{currentPreview.error}</p> : !currentPreview ? <p>Loading preview…</p> : null}
          {currentPreview?.score && <><h3>Tracks</h3><ul>{currentPreview.score.tracks.map((track) =>
            <li key={track.id}>{track.name}</li>)}</ul></>}
        </>}
      </section>
    </div>
    {status && <p className="homeStatus" role="status">{status}</p>}
    <input ref={input} hidden type="file" multiple aria-label="Select local score files"
      onChange={(event) => { setLocal(Array.from(event.target.files ?? [])); event.target.value = ""; }} />
  </>;
}
