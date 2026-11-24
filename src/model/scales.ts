export interface ScaleDefinition {
  id: string;
  name: string;
  tags: string[];
  intervals: number[];
  keywords: string[];
}

export interface ScaleSearchOptions {
  query?: string;
  tags?: string[];
  limit?: number;
}

export interface ScaleMatch {
  scale: ScaleDefinition;
  matchPercent: number;
  missing: number[];
  extra: number[];
}

const CORE_SCALES: Array<Omit<ScaleDefinition, "id" | "keywords"> & { aliases?: string[] }> = [
  { name: "Ionian", aliases: ["Major scale"], tags: ["major", "mode"], intervals: [0, 2, 4, 5, 7, 9, 11] },
  { name: "Dorian", tags: ["minor", "mode"], intervals: [0, 2, 3, 5, 7, 9, 10] },
  { name: "Phrygian", tags: ["minor", "mode"], intervals: [0, 1, 3, 5, 7, 8, 10] },
  { name: "Lydian", tags: ["major", "mode"], intervals: [0, 2, 4, 6, 7, 9, 11] },
  { name: "Mixolydian", tags: ["dominant", "mode"], intervals: [0, 2, 4, 5, 7, 9, 10] },
  { name: "Aeolian", aliases: ["Natural minor"], tags: ["minor", "mode"], intervals: [0, 2, 3, 5, 7, 8, 10] },
  { name: "Locrian", tags: ["minor", "mode", "diminished"], intervals: [0, 1, 3, 5, 6, 8, 10] },
  { name: "Major pentatonic", tags: ["major", "pentatonic"], intervals: [0, 2, 4, 7, 9] },
  { name: "Minor pentatonic", tags: ["minor", "pentatonic"], intervals: [0, 3, 5, 7, 10] },
  { name: "Blues", tags: ["minor", "blues"], intervals: [0, 3, 5, 6, 7, 10] },
  { name: "Major blues", tags: ["major", "blues"], intervals: [0, 2, 3, 4, 7, 9] },
  { name: "Harmonic minor", tags: ["minor", "harmonic"], intervals: [0, 2, 3, 5, 7, 8, 11] },
  { name: "Melodic minor", tags: ["minor", "jazz"], intervals: [0, 2, 3, 5, 7, 9, 11] },
  { name: "Lydian dominant", aliases: ["Lydian b7", "Overtone"], tags: ["dominant", "jazz"], intervals: [0, 2, 4, 6, 7, 9, 10] },
  { name: "Altered", aliases: ["Super Locrian", "Diminished whole tone"], tags: ["dominant", "jazz"], intervals: [0, 1, 3, 4, 6, 8, 10] },
  { name: "Bebop dominant", tags: ["dominant", "bebop"], intervals: [0, 2, 4, 5, 7, 9, 10, 11] },
  { name: "Bebop major", tags: ["major", "bebop"], intervals: [0, 2, 4, 5, 7, 8, 9, 11] },
  { name: "Whole tone", tags: ["symmetric"], intervals: [0, 2, 4, 6, 8, 10] },
  { name: "Diminished whole-half", tags: ["symmetric", "diminished"], intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
  { name: "Diminished half-whole", tags: ["symmetric", "diminished"], intervals: [0, 1, 3, 4, 6, 7, 9, 10] },
  { name: "Hungarian minor", tags: ["ethnic", "minor"], intervals: [0, 2, 3, 6, 7, 8, 11] },
  { name: "Double harmonic", tags: ["ethnic", "major"], intervals: [0, 1, 4, 5, 7, 8, 11] },
  { name: "Persian", tags: ["ethnic"], intervals: [0, 1, 4, 5, 6, 8, 11] },
  { name: "Japanese Hirajoshi", tags: ["ethnic", "pentatonic"], intervals: [0, 2, 3, 7, 8] },
  { name: "In Sen", tags: ["ethnic", "pentatonic"], intervals: [0, 1, 5, 7, 10] },
  { name: "Pelog", tags: ["ethnic"], intervals: [0, 1, 3, 7, 8] },
  { name: "Neapolitan minor", tags: ["minor"], intervals: [0, 1, 3, 5, 7, 8, 11] },
  { name: "Neapolitan major", tags: ["major"], intervals: [0, 1, 3, 5, 7, 9, 11] },
  { name: "Enigmatic", tags: ["synthetic"], intervals: [0, 1, 4, 6, 8, 10, 11] },
  { name: "Prometheus", tags: ["synthetic"], intervals: [0, 2, 4, 6, 9, 10] },
  { name: "Augmented", tags: ["symmetric"], intervals: [0, 3, 4, 7, 8, 11] },
  { name: "Six tone symmetric", tags: ["symmetric"], intervals: [0, 1, 4, 5, 8, 9] },
  { name: "Phrygian dominant", aliases: ["Harmonic minor fifth mode"], tags: ["dominant", "harmonic"], intervals: [0, 1, 4, 5, 7, 8, 10] },
  { name: "Romanian minor", aliases: ["Dorian #4"], tags: ["minor", "ethnic"], intervals: [0, 2, 3, 6, 7, 9, 10] },
  { name: "Ukrainian Dorian", tags: ["minor", "ethnic"], intervals: [0, 2, 3, 6, 7, 9, 10] },
  { name: "Spanish eight tone", tags: ["ethnic", "dominant"], intervals: [0, 1, 3, 4, 5, 6, 8, 10] },
  { name: "Arabian", tags: ["ethnic"], intervals: [0, 2, 4, 5, 6, 8, 10] },
  { name: "Hindu", aliases: ["Mixolydian b6", "Melodic major"], tags: ["dominant", "ethnic"], intervals: [0, 2, 4, 5, 7, 8, 10] },
  { name: "Leading whole tone", tags: ["jazz"], intervals: [0, 2, 4, 6, 8, 10, 11] },
  { name: "Lydian augmented", tags: ["major", "jazz"], intervals: [0, 2, 4, 6, 8, 9, 11] },
  { name: "Locrian natural 2", aliases: ["Locrian #2"], tags: ["minor", "jazz"], intervals: [0, 2, 3, 5, 6, 8, 10] },
  { name: "Locrian natural 6", tags: ["minor", "mode", "harmonic"], intervals: [0, 1, 3, 5, 6, 9, 10] },
  { name: "Ionian augmented", tags: ["major", "mode", "harmonic"], intervals: [0, 2, 4, 5, 8, 9, 11] },
  { name: "Lydian sharp 2", aliases: ["Lydian #2"], tags: ["major", "mode", "harmonic"], intervals: [0, 3, 4, 6, 7, 9, 11] },
  { name: "Ultralocrian", tags: ["diminished", "mode", "harmonic"], intervals: [0, 1, 3, 4, 6, 8, 9] },
  { name: "Dorian flat 2", aliases: ["Dorian b2", "Phrygian natural 6"], tags: ["minor", "mode", "melodic"], intervals: [0, 1, 3, 5, 7, 9, 10] }
];

export const SCALE_DEFINITIONS: ScaleDefinition[] = buildScaleDefinitions();

export function searchScales(options: ScaleSearchOptions = {}): ScaleDefinition[] {
  const query = options.query?.trim().toLowerCase() ?? "";
  const tags = options.tags ?? [];
  const limit = options.limit ?? 32;

  return SCALE_DEFINITIONS.filter((scale) => {
    const tagMatch = tags.every((tag) => scale.tags.includes(tag));
    const textMatch =
      query.length === 0 ||
      scale.name.toLowerCase().includes(query) ||
      scale.keywords.some((keyword) => keyword.includes(query));
    return tagMatch && textMatch;
  })
    .sort((left, right) => Number(right.keywords.includes(query)) - Number(left.keywords.includes(query)))
    .slice(0, limit);
}

export function scalePitchClasses(root: number, scale: ScaleDefinition): number[] {
  return scale.intervals.map((interval) => mod(root + interval, 12));
}

export function matchScalesFromPitchClasses(pitchClasses: number[], root = 0, limit = 12): ScaleMatch[] {
  const source = unique(pitchClasses.map((pc) => mod(pc, 12)));

  if (source.length === 0) {
    return [];
  }

  return SCALE_DEFINITIONS.map((scale) => {
    const target = scalePitchClasses(root, scale);
    const overlap = source.filter((pc) => target.includes(pc));
    const missing = target.filter((pc) => !source.includes(pc));
    const extra = source.filter((pc) => !target.includes(pc));
    return {
      scale,
      matchPercent: Math.round((overlap.length / Math.max(source.length, target.length)) * 100),
      missing,
      extra
    };
  })
    .sort((left, right) => right.matchPercent - left.matchPercent || left.scale.name.localeCompare(right.scale.name))
    .slice(0, limit);
}

function buildScaleDefinitions(): ScaleDefinition[] {
  const byPitchSet = new Map<number, ScaleDefinition>();
  for (const { name, tags, intervals, aliases = [] } of CORE_SCALES) {
    const pitchSet = intervals.reduce((mask, pitchClass) => mask | (1 << pitchClass), 0);
    const keywords = [name.toLowerCase(), ...tags, ...aliases.map((alias) => alias.toLowerCase())];
    const previous = byPitchSet.get(pitchSet);
    if (previous) {
      previous.tags = unique([...previous.tags, ...tags]);
      previous.keywords = unique([...previous.keywords, ...keywords]);
    } else {
      byPitchSet.set(pitchSet, { id: slug(name), name, tags, intervals, keywords });
    }
  }
  return [...byPitchSet.values()];
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
