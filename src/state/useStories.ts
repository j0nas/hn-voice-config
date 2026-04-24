import { create } from 'zustand';
import type { HNItem } from '../api/hn';

type StoriesState = {
  stories: HNItem[];
  loading: boolean;
  error: string | null;
  setStories: (stories: HNItem[]) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
};

export const useStories = create<StoriesState>((set) => ({
  stories: [],
  loading: false,
  error: null,
  setStories: (stories) => set({ stories }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
