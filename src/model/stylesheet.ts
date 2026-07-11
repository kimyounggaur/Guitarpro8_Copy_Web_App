import type {
  DisplayMode,
  Score,
  Stylesheet,
  StylesheetPresetName
} from "./types";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface PageMetrics {
  pageWidth: number;
  pageHeight: number;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  headerHeight: number;
  contentWidth: number;
  systemGap: number;
  trackGap: number;
  continuous: boolean;
  pageFill: string;
  pageStroke: string;
  pageStrokeWidth: number;
}

const DEFAULT_STYLESHEET: Stylesheet = {
  presetName: "Classic",
  page: {
    paper: "A4",
    orientation: "portrait",
    width: 794,
    height: 1123,
    marginLeft: 56,
    marginRight: 56,
    marginTop: 72,
    marginBottom: 64,
    pageFill: "#fbfaf7",
    pageStroke: "#d8d2c5",
    pageStrokeWidth: 1,
    showPageShadow: true,
    justifyLastSystem: false,
    rhythmProportion: 1,
    firstSystemIndent: 0,
    systemScale: 1,
    minMeasureWidth: 86
  },
  systems: {
    systemGap: 34,
    trackGap: 28,
    staffLineColor: "#202020",
    staffLineThickness: 1,
    barlineColor: "#111827",
    barlineThickness: 1,
    bracketThickness: 1,
    showTrackNames: "everySystem",
    useShortNames: true,
    hideEmptyStaves: false,
    hideTabForStandardOnly: false,
    capoShiftAffectsNotation: false,
    tuningNotice: true
  },
  headerFooter: {
    headerVisibility: "firstPage",
    footerVisibility: "everyPage",
    firstPageTitle: "%TITLE%",
    firstPageSubtitle: "%SUBTITLE%",
    leftHeader: "%ARTIST%",
    centerHeader: "%TITLE%",
    rightHeader: "%ALBUM%",
    leftFooter: "%COPYRIGHT%",
    centerFooter: "Page %PAGE% / %PAGES%",
    rightFooter: "%TABBER%",
    showPageNumbers: true,
    showCopyright: true
  },
  texts: {
    titleFont: "Inter, Arial, sans-serif",
    titleSize: 18,
    subtitleFont: "Inter, Arial, sans-serif",
    subtitleSize: 12,
    bodyFont: "Inter, Arial, sans-serif",
    bodySize: 11,
    chordFont: "Inter, Arial, sans-serif",
    chordSize: 11,
    lyricsFont: "Inter, Arial, sans-serif",
    lyricsSize: 10,
    lyricsPosition: "below",
    tempoDecimals: 0,
    barNumberFrequency: "everySystem",
    barNumberSize: 9,
    sectionFontSize: 11,
    dynamicFontSize: 12
  },
  notation: {
    replaceCommonTime: true,
    replaceCutTime: true,
    showTabRhythm: true,
    tabRhythmPositionVoice1: "below",
    tabRhythmPositionVoice2: "above",
    tabRhythmPositionVoice3: "hidden",
    tabRhythmPositionVoice4: "hidden",
    colorizeTabVoices: true,
    showVoiceStems: true,
    stemDirectionVoice1: "auto",
    stemDirectionVoice2: "auto",
    restPositionVoice1: "auto",
    restPositionVoice2: "auto"
  },
  symbols: {
    style: "Classic",
    textColor: "#1f2937",
    mutedTextColor: "#4b5563",
    effectColor: "#1d4ed8",
    sectionBoxFill: "#f8fafc",
    extendLinesOverRests: true,
    palmMuteText: "PM",
    letRingText: "let ring",
    harmonicText: "N.H.",
    tapText: "T",
    slapText: "S",
    popText: "P",
    pickstrokeDownText: "v",
    pickstrokeUpText: "^",
    bendText: "bend",
    trillText: "tr",
    showChordNames: true,
    showChordDiagrams: true,
    chordDiagramScale: 1,
    chordDiagramSpacing: 18,
    scaleDiagramSpacing: 14,
    showDirections: true,
    showFermatas: true,
    showDynamics: true,
    showGraceNotes: true,
    showTupletBrackets: true,
    showOttava: true,
    showWhammy: true,
    showBrush: true,
    showPickstroke: true,
    showLeftHandFingerings: true,
    showRightHandFingerings: true
  },
  fingerings: {
    leftHandPosition: "left",
    rightHandPosition: "right",
    showStringNumbers: true,
    stringNumberCircle: true,
    barreDisplay: "roman",
    fingeringScale: 1
  }
};

export const STYLE_PRESETS: Record<StylesheetPresetName, DeepPartial<Stylesheet>> = {
  Classic: {
    presetName: "Classic",
    page: {
      pageFill: "#fbfaf7",
      pageStroke: "#d8d2c5",
      systemScale: 1
    },
    systems: {
      systemGap: 34,
      staffLineColor: "#202020",
      staffLineThickness: 1
    },
    texts: {
      titleFont: "Inter, Arial, sans-serif",
      titleSize: 18,
      chordFont: "Inter, Arial, sans-serif"
    },
    symbols: {
      style: "Classic",
      textColor: "#1f2937",
      mutedTextColor: "#4b5563",
      sectionBoxFill: "#f8fafc",
      palmMuteText: "PM",
      letRingText: "let ring",
      harmonicText: "N.H."
    }
  },
  Jazz: {
    presetName: "Jazz",
    page: {
      pageFill: "#fffdf4",
      pageStroke: "#d7c99b",
      rhythmProportion: 1.08,
      systemScale: 1.02
    },
    systems: {
      systemGap: 38,
      staffLineColor: "#1f2937",
      staffLineThickness: 1.15
    },
    texts: {
      titleFont: "Georgia, serif",
      titleSize: 20,
      chordFont: "Georgia, serif",
      chordSize: 12,
      sectionFontSize: 12
    },
    symbols: {
      style: "Jazz",
      textColor: "#243447",
      mutedTextColor: "#5b6472",
      sectionBoxFill: "#fff8d6",
      palmMuteText: "P.M.-----",
      letRingText: "let ring-----",
      harmonicText: "harm.",
      bendText: "b",
      trillText: "tr~~"
    }
  },
  Rock: {
    presetName: "Rock",
    page: {
      pageFill: "#f6f7f3",
      pageStroke: "#9ca3af",
      rhythmProportion: 0.96,
      systemScale: 0.98
    },
    systems: {
      systemGap: 30,
      staffLineColor: "#111827",
      staffLineThickness: 1.25,
      barlineColor: "#111827",
      barlineThickness: 1.2
    },
    texts: {
      titleFont: "Arial Black, Impact, sans-serif",
      titleSize: 20,
      chordFont: "Inter, Arial, sans-serif",
      chordSize: 11
    },
    symbols: {
      style: "Classic",
      textColor: "#111827",
      mutedTextColor: "#374151",
      effectColor: "#b91c1c",
      sectionBoxFill: "#e5e7eb",
      palmMuteText: "PM---",
      letRingText: "ring---",
      harmonicText: "Harm.",
      slapText: "slap",
      popText: "pop"
    }
  }
};

export function createDefaultStylesheet(): Stylesheet {
  return clone(DEFAULT_STYLESHEET);
}

export function normalizeStylesheet(stylesheet: unknown): Stylesheet {
  if (!isRecord(stylesheet) || stylesheet.placeholder === true) {
    return createDefaultStylesheet();
  }

  return mergeStylesheet(createDefaultStylesheet(), stylesheet as DeepPartial<Stylesheet>);
}

export function applyStylePreset(
  stylesheet: Stylesheet,
  presetName: StylesheetPresetName
): Stylesheet {
  return mergeStylesheet(stylesheet, STYLE_PRESETS[presetName]);
}

export function resolvePageMetrics(
  stylesheetInput: unknown,
  displayMode: DisplayMode = "vertical-page"
): PageMetrics {
  const stylesheet = normalizeStylesheet(stylesheetInput);
  const page = stylesheet.page;
  const isLandscape = page.orientation === "landscape";
  const baseWidth = isLandscape ? Math.max(page.width, page.height) : Math.min(page.width, page.height);
  const baseHeight = isLandscape ? Math.min(page.width, page.height) : Math.max(page.width, page.height);
  const screenWidth =
    displayMode === "horizontal-screen"
      ? Math.max(baseWidth, 1280)
      : displayMode === "vertical-screen"
        ? Math.max(baseWidth, 960)
        : baseWidth;
  const pageWidth = displayMode.endsWith("screen") ? screenWidth : baseWidth;
  const pageHeight = displayMode === "horizontal-screen" ? Math.max(baseHeight, 720) : baseHeight;
  const marginLeft = clamp(page.marginLeft, 18, pageWidth / 3);
  const marginRight = clamp(page.marginRight, 18, pageWidth / 3);
  const marginTop = clamp(page.marginTop, 28, pageHeight / 3);
  const marginBottom = clamp(page.marginBottom, 28, pageHeight / 3);
  const headerHeight = Math.max(54, stylesheet.texts.titleSize + stylesheet.texts.subtitleSize + 24);

  return {
    pageWidth,
    pageHeight,
    marginLeft,
    marginRight,
    marginTop,
    marginBottom,
    headerHeight,
    contentWidth: Math.max(240, pageWidth - marginLeft - marginRight),
    systemGap: clamp(stylesheet.systems.systemGap, 12, 96),
    trackGap: clamp(stylesheet.systems.trackGap, 10, 80),
    continuous: displayMode === "parchment" || displayMode.endsWith("screen"),
    pageFill: page.pageFill,
    pageStroke: page.pageStroke,
    pageStrokeWidth: page.pageStrokeWidth
  };
}

export function renderHeaderToken(
  template: string,
  score: Score,
  pageIndex: number,
  pageCount: number
): string {
  const tokens: Record<string, string> = {
    "%TITLE%": score.meta.title || "Untitled Score",
    "%SUBTITLE%": score.meta.subtitle,
    "%ARTIST%": score.meta.artist,
    "%ALBUM%": score.meta.album,
    "%WORDS%": score.meta.words,
    "%MUSIC%": score.meta.music,
    "%TABBER%": score.meta.transcriber,
    "%COPYRIGHT%": score.meta.copyright,
    "%PAGE%": String(pageIndex + 1),
    "%PAGES%": String(pageCount)
  };

  return Object.entries(tokens)
    .reduce((text, [token, value]) => text.split(token).join(value), template)
    .trim();
}

function mergeStylesheet(base: Stylesheet, patch: DeepPartial<Stylesheet>): Stylesheet {
  return deepMerge(base, patch) as Stylesheet;
}

function deepMerge<T>(base: T, patch: DeepPartial<T>): T {
  const next = clone(base);

  if (!isRecord(next) || !isRecord(patch)) {
    return (patch === undefined ? next : patch) as T;
  }

  Object.entries(patch).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }

    const current = (next as Record<string, unknown>)[key];

    if (isRecord(current) && isRecord(value)) {
      (next as Record<string, unknown>)[key] = deepMerge(current, value);
    } else {
      (next as Record<string, unknown>)[key] = clone(value);
    }
  });

  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
