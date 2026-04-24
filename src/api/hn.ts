import type { Feed } from '../config/schema';

const BASE = 'https://hacker-news.firebaseio.com/v0';

const FEED_ENDPOINT: Record<Feed, string> = {
  top: 'topstories',
  new: 'newstories',
  best: 'beststories',
  ask: 'askstories',
  show: 'showstories',
  jobs: 'jobstories',
};

export type HNItem = {
  id: number;
  type?: 'story' | 'job' | 'comment' | 'poll' | 'pollopt';
  by?: string;
  time?: number;
  title?: string;
  url?: string;
  score?: number;
  descendants?: number;
  text?: string;
  dead?: boolean;
  deleted?: boolean;
};

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${BASE}/${path}.json`, { signal });
  if (!res.ok) throw new Error(`HN ${path} ${res.status}`);
  return (await res.json()) as T;
}

export async function fetchStoryIds(feed: Feed, signal?: AbortSignal): Promise<number[]> {
  return getJson<number[]>(FEED_ENDPOINT[feed], signal);
}

async function mapWithConcurrency<I, O>(
  items: I[],
  limit: number,
  fn: (item: I, idx: number) => Promise<O>,
): Promise<O[]> {
  const out = new Array<O>(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function fetchStories(feed: Feed, limit: number, signal?: AbortSignal): Promise<HNItem[]> {
  const ids = await fetchStoryIds(feed, signal);
  const slice = ids.slice(0, limit);
  const items = await mapWithConcurrency(slice, 8, (id) => getJson<HNItem>(`item/${id}`, signal));
  return items.filter((it) => it && !it.dead && !it.deleted);
}

