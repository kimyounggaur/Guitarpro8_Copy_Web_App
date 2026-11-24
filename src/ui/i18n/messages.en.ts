const messages = {
  product: "TabScore",
  newScore: "New score",
  openFile: "Open file",
  recentFiles: "Recent files",
  demo: "View demo",
  instrument: "Instrument",
  tuning: "Tuning",
  meter: "Time signature",
  tempo: "Tempo",
  create: "Create score",
  cancel: "Cancel"
} as const;

export function t(key: keyof typeof messages): string {
  return messages[key];
}
