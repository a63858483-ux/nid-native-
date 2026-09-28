import { useEffect, useState } from 'react';

import { API_BASE } from './config';

export type Sticker = { id: string; owner: 'user' | 'assistant'; name: string; url: string; thumbnail?: string; emotion_tags?: string[] };

let cache: Sticker[] | null = null;
let inflight: Promise<Sticker[]> | null = null;
const listeners = new Set<() => void>();

// Sticker files themselves are served without auth; only the list needs the token.
export async function loadStickers(fetchList: () => Promise<Sticker[]>): Promise<Sticker[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = fetchList()
      .then((s) => {
        cache = s;
        listeners.forEach((l) => l());
        return s;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function stickerUrl(id: string): string | null {
  const s = cache?.find((x) => x.id === id);
  return s ? API_BASE + s.url : null;
}

export function useStickers(fetchList: () => Promise<Sticker[]>) {
  const [list, setList] = useState<Sticker[] | null>(cache);
  useEffect(() => {
    const l = () => setList(cache);
    listeners.add(l);
    if (!cache) loadStickers(fetchList).catch(() => setList([]));
    return () => {
      listeners.delete(l);
    };
  }, [fetchList]);
  return list;
}
