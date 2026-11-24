import { useId } from "react";

// Original monoline pictograms on a 24-unit grid.
const paths = {
  home: "M3 11 12 4l9 7M6 10v10h5v-6h3v6h4V10",
  file: "M3 7h7l2 3h9l-2 9H3zM4 7V5h6l2 2h7v3",
  palette: "M3 4h18v16H3zM9 4v16M5 8h2m-2 4h2",
  inspector: "M3 4h18v16H3zM15 4v16M17 8h2m-2 4h2",
  global: "M3 4h18v16H3zM3 13h18m-14 3h3m2 0h5",
  automation: "m3 17 6-8 5 3 7-7M3 20h18",
  song: "M4 5h16M4 9h9m1 7V5l4 2M14 16c0 4-6 4-6 1s6-3 6-1",
  zoomIn: "M15 15l6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M6.5 10h7m-3.5-3.5v7",
  zoomOut: "M15 15l6 6M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0M6.5 10h7",
  page: "M5 3h10l4 4v14H5zM15 3v5h4M8 12h8m-8 4h7",
  landscape: "M2 6h20v13H2zM6 10h11m-11 4h9",
  grid: "M3 4h8v7H3zM14 4h7v7h-7zM3 14h8v7H3zM14 14h7v7h-7z",
  parchment: "M7 4h12c3 0 3 5 0 5h-2m0-5v14c0 4-6 4-6 0H4v-2h10M7 4v12",
  screen: "M3 4h18v13H3zM12 17v3m-5 0h10M9 7l3-2 3 2m-3-2v8",
  horizontal: "M3 4h18v13H3zM12 17v3m-5 0h10M6 10h12m-3-3 3 3-3 3",
  undo: "m8 5-5 5 5 5M3 10h10c5 0 8 3 8 8",
  redo: "m16 5 5 5-5 5m5-5H11c-5 0-8 3-8 8",
  print: "M6 9V3h12v6M6 17H3V9h18v8h-3M6 14h12v7H6z",
  first: "M5 5v14m13-14L8 12l10 7z",
  previous: "m17 5-9 7 9 7",
  play: "m7 4 13 8-13 8z",
  stop: "M6 6h12v12H6z",
  next: "m7 5 9 7-9 7",
  last: "M19 5v14M6 5l10 7-10 7z",
  loop: "M3 11V8h15l-3-3m3 3-3 3M21 13v3H6l3 3m-3-3 3-3",
  count: "M3 17v-4m5 4V8m5 9V5m5 12v-7",
  metronome: "M10 3h4l5 17H5zM11 15l7-9m-9 11h5",
  settings: "M3 7h5m5 0h8M3 17h10m4 0h4M9 4h3v6H9zM13 14h3v6h-3z",
  tracks: "M3 5h17M3 11h13M3 17h16m-14-14v4m6 2v4m-3 2v4",
  speed: "M3 17a9 9 0 0 1 18 0M12 16l5-7m-9 10h8",
  key: "M13 15a5 5 0 1 1 2-4l6-6 2 2-3 3m-1-1-2 2",
  audio: "M3 12h2l2-7 4 14 3-16 3 13 2-4h2",
  instrument: "m17 4 3 3-8 9c1 4-4 7-7 4s0-8 4-7zM8 16l1 1",
  tuner: "M7 3v7c0 7 10 7 10 0V3m-5 12v6",
  addTrack: "M3 6h17M3 12h10m-10 6h7m7-5v8m-4-4h8",
  voices: "M5 6h7m-7 4h4m3 4h7m-7 4h4M16 4v7m-8 2v7",
  drums: "M3 8c0-5 18-5 18 0s-18 5-18 0zm0 0v8c0 5 18 5 18 0V8M7 10l2 7 4-6 3 6",
  command: "m4 7 5 5-5 5m8 0h8",
  style: "M5 18h14M7 15l5-11 5 11m-8-4h6",
  chord: "M5 4v16m5-16v16m5-16v16m5-16v16M4 6h17M4 12h17M4 18h17",
  scale: "M3 18h4v-4h5v-4h5V6h4",
  transpose: "M4 16 9 21l5-5m-5 5V5m3 3 5-5 5 5m-5-5v16",
  check: "m4 12 5 5L20 6",
  more: "M4 11h2v2H4zm7 0h2v2h-2zm7 0h2v2h-2z",
  down: "m6 9 6 6 6-6",
  close: "m5 5 14 14M19 5 5 19",
  tuning: "M3 7h18M3 16h18M7 4v6m9 3v6"
} as const;

export type IconName = keyof typeof paths;
type AppIconProps = { name: IconName; size?: number; strokeWidth?: number } & (
  | { decorative?: true; label?: never }
  | { decorative: false; label: string }
);

export function AppIcon({ name, size = 18, strokeWidth = 1.75, decorative = true, label }: AppIconProps) {
  const titleId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      aria-hidden={decorative || undefined}
      role={decorative ? undefined : "img"}
      aria-labelledby={decorative ? undefined : titleId}
    >
      {!decorative && <title id={titleId}>{label}</title>}
      <path d={paths[name]} />
    </svg>
  );
}
