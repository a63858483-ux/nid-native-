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

// ── Her Apple Music library (read on the phone with her own account) ──

export type Track = { id: string; library: boolean; title: string; artist: string; album: string; artwork: string; color: string; duration: number };
export type Shelf = { id: string; library: boolean; name: string; artwork: string; kind: 'playlist' | 'album' | 'artist'; sub?: string };

type Res = { id: string; type: string; attributes?: Record<string, any>; relationships?: Record<string, { data?: Res[] }> };
const art = (a?: { url?: string }, size = 300) => (a?.url ? a.url.replace('{w}', String(size)).replace('{h}', String(size)) : '');

async function me(path: string): Promise<Res[]> {
  if (!NidMusic) throw new Error('needs-build');
  const status = await NidMusic.authorize();
  if (status !== 'authorized') throw new Error('denied');
  const body = JSON.parse((await NidMusic.api(path)) || '{}');
  return (body.data ?? []) as Res[];
}

function toTrack(r: Res): Track {
  const a = r.attributes ?? {};
  const pp = a.playParams ?? {};
  const catalogId = pp.catalogId ?? (r.type === 'songs' ? r.id : undefined);
  return {
    id: catalogId ?? pp.id ?? r.id,
    library: !catalogId,
    title: a.name ?? '',
    artist: a.artistName ?? '',
    album: a.albumName ?? '',
    artwork: art(a.artwork),
    color: a.artwork?.bgColor ? `#${a.artwork.bgColor}` : '',
    duration: (a.durationInMillis ?? 0) / 1000,
  };
}

export const recentTracks = async (limit = 30) => (await me(`/v1/me/recent/played/tracks?limit=${Math.min(limit, 30)}&types=songs,library-songs`)).map(toTrack).filter((t) => t.title);

export async function playlists(): Promise<Shelf[]> {
  const rows = await me('/v1/me/library/playlists?limit=100');
  return rows.map((r) => ({ id: r.id, library: true, name: r.attributes?.name ?? '', artwork: art(r.attributes?.artwork), kind: 'playlist' as const }));
}
export const isFavourites = (s: Shelf) => /favou?rite songs|喜爱的歌曲|最喜爱|喜欢的歌/i.test(s.name);
export const playlistTracks = async (id: string) => (await me(`/v1/me/library/playlists/${id}/tracks?limit=100`)).map(toTrack);

export async function artists(): Promise<Shelf[]> {
  const rows = await me('/v1/me/library/artists?limit=100&include=catalog');
  return rows.map((r) => {
    const cat = r.relationships?.catalog?.data?.[0];
    return { id: r.id, library: true, name: r.attributes?.name ?? '', artwork: art(cat?.attributes?.artwork, 300), kind: 'artist' as const };
  });
}
export async function artistAlbums(id: string): Promise<Shelf[]> {
  const rows = await me(`/v1/me/library/artists/${id}/albums?limit=100`);
  return rows.map((r) => ({ id: r.id, library: true, name: r.attributes?.name ?? '', artwork: art(r.attributes?.artwork), kind: 'album' as const, sub: r.attributes?.releaseDate?.slice(0, 4) }));
}
export const albumTracks = async (id: string) => (await me(`/v1/me/library/albums/${id}/tracks?limit=100`)).map(toTrack);

// Play a list starting at one track; catalog and library tracks cannot share one queue.
export async function playTracks(list: Track[], start: number) {
  if (!NidMusic) return;
  const t = list[start];
  const same = list.filter((x) => x.library === t.library);
  await NidMusic.play('songs', same.map((x) => x.id), t.library, Math.max(0, same.indexOf(t)));
}
export const playShelf = (s: Shelf) => NidMusic?.play(s.kind === 'album' ? 'album' : 'playlist', [s.id], s.library, 0);

// Catalog search through our server (works before she grants Apple Music access).
export const searchSongs = async (term: string) =>
  ((await call(`/api/music/search?limit=25&term=${encodeURIComponent(term)}`)) as { songs: Song[] }).songs.map(
    (s): Track => ({ id: s.id, library: false, title: s.title, artist: s.artist, album: s.album, artwork: s.artwork, color: s.color, duration: s.duration }),
  );

// Songs he played for her in chat, newest first.
export const picks = async () => ((await call('/api/music/picks')) as { items: { query: string; at: string }[] }).items;

// Favourite (Apple Music's "love") needs a build with the write call.
export async function setFavourite(catalogId: string, on: boolean): Promise<boolean> {
  if (!NidMusic?.request) return false;
  if (on) await NidMusic.request('PUT', `/v1/me/ratings/songs/${catalogId}`, JSON.stringify({ type: 'rating', attributes: { value: 1 } }));
  else await NidMusic.request('DELETE', `/v1/me/ratings/songs/${catalogId}`, '');
  return true;
}
export async function isFavourite(catalogId: string): Promise<boolean> {
  try {
    const rows = await me(`/v1/me/ratings/songs/${catalogId}`);
    return rows[0]?.attributes?.value === 1;
  } catch {
    return false;
  }
}

// Synced lyrics from the server (LRCLIB), parsed to [seconds, line].
export async function lyricsOf(title: string, artist: string, duration: number): Promise<[number, string][]> {
  const r = (await call(`/api/music/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&duration=${Math.round(duration)}`)) as { synced?: string; plain?: string };
  if (r.synced) {
    return r.synced
      .split('\n')
      .map((l) => /^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/.exec(l))
      .filter((m): m is RegExpExecArray => !!m && !!m[3])
      .map((m) => [Number(m[1]) * 60 + Number(m[2]), m[3]]);
  }
  return (r.plain || '')
    .split('\n')
    .filter(Boolean)
    .map((l) => [-1, l]);
}

// A song she picked to send him: the player and the Music sheet hand it to the chat composer.
export const SHARE_SONG = 'nid.shareSong';
export type SharedSong = { id: string; title: string; artist: string; artwork: string; color: string };
