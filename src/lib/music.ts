import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { NidMusic, type NowState } from '../../modules/nid-music';
import { call } from './api';
import { openPublic } from './open';

export type Song = { id: string; title: string; artist: string; album: string; artwork: string; color: string; duration: number; url: string };

// Catalog lookups go through our server (developer token), so they work before she grants access.
const found = new Map<string, Song | null>();
const pending = new Map<string, Promise<Song | null>>();
export function findSong(query: string): Promise<Song | null> {
  if (found.has(query)) return Promise.resolve(found.get(query) ?? null);
  let p = pending.get(query);
  if (!p) {
    p = (call(`/api/music/search?limit=1&term=${encodeURIComponent(query)}`) as Promise<{ songs: Song[] }>)
      .then((r) => {
        const s = r.songs[0] ?? null;
        found.set(query, s);
        return s;
      })
      .finally(() => pending.delete(query));
    pending.set(query, p);
  }
  return p;
}

export const musicAvailable = () => !!NidMusic;

// Plays in the Music app's own player (lock screen, AirPods, Dynamic Island all native).
// Without the native module (older builds) the song opens in Apple Music instead.
export async function playSong(song: Song): Promise<'playing' | 'denied' | 'opened'> {
  if (!NidMusic) {
    await openPublic(song.url);
    return 'opened';
  }
  const status = await NidMusic.authorize();
  if (status !== 'authorized') return 'denied';
  await NidMusic.play('songs', [song.id], false, 0);
  return 'playing';
}

// What the Music player is doing, refreshed on every change and twice a second while mounted.
export function useNowPlaying(tick = true): NowState | null {
  const [s, setS] = useState<NowState | null>(() => (NidMusic ? NidMusic.state() : null));
  useEffect(() => {
    if (!NidMusic) return;
    const mod = NidMusic;
    const sub = mod.addListener('onChange', setS);
    const t = tick ? setInterval(() => setS(mod.state()), 500) : undefined;
    return () => {
      sub.remove();
      if (t) clearInterval(t);
    };
  }, [tick]);
  return s;
}

// Tells the server what she is playing, so he knows. Only when the song or play/pause changes.
export function startNowPlayingReports() {
  if (!NidMusic) return () => {};
  const mod = NidMusic;
  let last = '';
  const report = (s: NowState) => {
    const key = `${s.item?.title ?? ''}|${s.item?.artist ?? ''}|${s.playing}`;
    if (!s.item || key === last) return;
    last = key;
    call('/api/music/now', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state: s }) }).catch(() => {
      last = '';
    });
  };
  const sub = mod.addListener('onChange', report);
  const app = AppState.addEventListener('change', (st) => st === 'active' && report(mod.state()));
  report(mod.state());
  return () => {
    sub.remove();
    app.remove();
  };
}
