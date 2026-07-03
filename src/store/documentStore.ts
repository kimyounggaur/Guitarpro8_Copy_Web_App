import { create } from "zustand";
import { createEmptyScore } from "../model/factory";
import type { Score } from "../model/types";

interface DocumentStore {
  score: Score;
  dirty: boolean;
  setScore: (score: Score) => void;
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  score: createEmptyScore(),
  dirty: false,
  setScore: (score) => set({ score, dirty: true })
}));
