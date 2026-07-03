export interface SongInfo {
  title: string;
}

export interface Score {
  meta: SongInfo;
  masterBars: unknown[];
  tracks: unknown[];
}
