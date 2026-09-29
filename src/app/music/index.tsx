import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GROUND, INK, MiniPlayer, MUTED, shelfTile, Tile, TrackRow } from '@/components/music/Parts';
import { StudyTabBar } from '@/components/study/TabBar';
import * as M from '@/lib/music';
import { useApp } from '@/state/app';

// A cover's colour, pushed dark enough for white text on it.
function deep(hex: string) {
  const v = parseInt((hex || '#333333').replace('#', ''), 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  const k = Math.min(1, 95 / Math.max(1, 0.299 * r + 0.587 * g + 0.114 * b));
  return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
}

type Pick = { query: string; at: string; track: M.Track | null };

const whenOf = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 8 * 3600_000);
  const today = new Date(Date.now() + 8 * 3600_000);
  const hm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  return d.toISOString().slice(0, 10) === today.toISOString().slice(0, 10) ? `Today ${hm}` : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

function Search({ value, onChange }: { value: string; onChange: (s: string) => void }) {
  return (
    <View style={styles.search}>
      <SymbolView name="magnifyingglass" size={15} tintColor={MUTED} />
      <TextInput value={value} onChangeText={onChange} placeholder="Search Apple Music" placeholderTextColor={MUTED} style={styles.searchInput} returnKeyType="search" clearButtonMode="while-editing" autoCorrect={false} />
    </View>
  );
}

// Music (her spec, 2026-09-29): two tabs only. Music = what he played for her in chat and what she
// played lately; Library = favourite songs, artists, playlists. Search sits on each page.
export default function Music() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { showToast } = useApp();
  const now = M.useNowPlaying(false);
  const [tab, setTab] = useState(0);
  const [folded, setFolded] = useState(false);
  const [q, setQ] = useState(['', '']);
  const [hits, setHits] = useState<M.Track[] | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [recent, setRecent] = useState<M.Track[]>([]);
  const [favs, setFavs] = useState<M.Track[]>([]);
  const [favShelf, setFavShelf] = useState<M.Shelf | null>(null);
  const [lists, setLists] = useState<M.Shelf[]>([]);
  const [people, setPeople] = useState<M.Shelf[]>([]);
  const [problem, setProblem] = useState<'' | 'needs-build' | 'denied'>('');
  const [loading, setLoading] = useState(true);
  const lastY = useRef<Record<number, number>>({});

  const load = useCallback(async () => {
    const fail = (e: unknown) => {
      const m = e instanceof Error ? e.message : '';
      if (m === 'needs-build' || m === 'denied') setProblem(m);
    };
    M.picks()
      .then(async (items) => setPicks(await Promise.all(items.map(async (p) => ({ ...p, track: await M.searchSongs(p.query).then((r) => r[0] ?? null).catch(() => null) })))))
      .catch(() => {});
    await Promise.all([
      M.recentTracks().then(setRecent).catch(fail),
      M.playlists()
        .then(async (pl) => {
          const fav = pl.find(M.isFavourites) ?? null;
          setFavShelf(fav);
          setLists(pl.filter((p) => p !== fav));
          if (fav) setFavs(await M.playlistTracks(fav.id));
        })
        .catch(fail),
      M.artists().then(setPeople).catch(fail),
    ]);
    setLoading(false);
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Search is shared by both pages; it waits for her to stop typing.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSearch = (i: number, s: string) => {
    setQ((cur) => cur.map((v, k) => (k === i ? s : v)));
    if (timer.current) clearTimeout(timer.current);
    if (!s.trim()) return setHits(null);
    timer.current = setTimeout(() => {
      M.searchSongs(s.trim())
        .then(setHits)
        .catch(() => setHits([]));
    }, 350);
  };

  const play = async (list: M.Track[], i: number) => {
    Keyboard.dismiss();
    try {
      await M.playTracks(list, i);
    } catch {
      showToast(problem === 'needs-build' ? 'Music needs the newer app build' : "Couldn't play that one");
    }
  };
  const onScroll = (page: number) => (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const prev = lastY.current[page] ?? 0;
    lastY.current[page] = y;
    if (y > prev + 6 && y > 40 && !folded) setFolded(true);
    else if (y < prev - 6 && folded) setFolded(false);
  };

  const playingId = now?.item?.songId;
  const col = (width - 40 - 14) / 2;
  const pickTracks = useMemo(() => picks.map((p) => p.track).filter((t): t is M.Track => !!t), [picks]);
  const bottomPad = insets.bottom + (now?.item ? 190 : 120);

  const results = (
    <View style={styles.sec}>
      <Text style={styles.sh}>Songs</Text>
      <View style={styles.card}>
        {hits?.length ? (
          hits.map((t, i) => <TrackRow key={t.id} t={t} first={i === 0} on={t.id === playingId} onPress={() => play(hits, i)} />)
        ) : (
          <Text style={styles.empty}>{hits ? 'No songs match. Try the artist’s name.' : 'Searching…'}</Text>
        )}
      </View>
    </View>
  );
  const notice = problem ? (
    <Text style={styles.notice}>{problem === 'needs-build' ? 'Update Nid from TestFlight to use your music here.' : 'Nid can’t see your music yet. Turn on Media & Apple Music for Nid douillet in Settings.'}</Text>
  ) : null;

  const music = (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: bottomPad }} onScroll={onScroll(0)} scrollEventThrottle={32} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityLabel="Back to chat">
          <SymbolView name="chevron.left" size={17} weight="semibold" tintColor={INK} />
        </Pressable>
        <Text style={styles.title}>Music</Text>
      </View>
      <Search value={q[0]} onChange={(s) => onSearch(0, s)} />
      {q[0].trim() ? (
        results
      ) : (
        <>
          {notice}
          <View style={styles.sec}>
            <View style={styles.shRow}>
              <Text style={styles.sh}>From Antoine</Text>
              <Text style={styles.shNote}>songs he played in chat</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hrow}>
              {picks.length === 0 && <Text style={styles.empty}>When he plays you a song in chat, it shows up here.</Text>}
              {picks.map((p) =>
                p.track ? (
                  <Pressable key={p.query} onPress={() => play(pickTracks, pickTracks.indexOf(p.track!))} style={({ pressed }) => [styles.pick, { backgroundColor: deep(p.track!.color) }, pressed && { opacity: 0.85 }]}>
                    <Image source={p.track.artwork || undefined} style={styles.pickArt} contentFit="cover" transition={120} />
                    <View style={styles.pickFoot}>
                      <Text style={styles.pickWhen}>{whenOf(p.at)} · in chat</Text>
                      <Text numberOfLines={1} style={styles.pickTitle}>
                        {p.track.title}
                      </Text>
                      <Text numberOfLines={1} style={styles.pickArtist}>
                        {p.track.artist}
                      </Text>
                    </View>
                  </Pressable>
                ) : null,
              )}
            </ScrollView>
          </View>
          <View style={styles.sec}>
            <Text style={[styles.sh, styles.pad]}>Recently Played</Text>
            {loading && recent.length === 0 && !problem ? <ActivityIndicator style={{ marginTop: 20 }} /> : null}
            <View style={styles.grid}>
              {recent.map((t, i) => (
                <Tile key={`${t.id}-${i}`} art={t.artwork} title={t.title} sub={t.artist} size={col} onPress={() => play(recent, i)} />
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );

  const library = (
    <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingBottom: bottomPad }} onScroll={onScroll(1)} scrollEventThrottle={32} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityLabel="Back to chat">
          <SymbolView name="chevron.left" size={17} weight="semibold" tintColor={INK} />
        </Pressable>
        <Text style={styles.title}>Library</Text>
      </View>
      <Search value={q[1]} onChange={(s) => onSearch(1, s)} />
      {q[1].trim() ? (
        results
      ) : (
        <>
          {notice}
          <View style={styles.sec}>
            <Pressable
              disabled={!favShelf}
              onPress={() => favShelf && router.push({ pathname: '/music/list', params: { kind: 'playlist', id: favShelf.id, name: 'Favourite Songs', art: '' } })}
              style={styles.shRow}>
              <Text style={styles.sh}>Favourite Songs</Text>
              {favShelf && <SymbolView name="chevron.right" size={14} weight="semibold" tintColor={MUTED} />}
            </Pressable>
            <View style={styles.card}>
              {favs.length === 0 ? (
                <Text style={styles.empty}>{loading ? 'Loading…' : 'Songs you mark with a star in Apple Music show up here.'}</Text>
              ) : (
                favs.slice(0, 6).map((t, i) => <TrackRow key={`${t.id}-${i}`} t={t} first={i === 0} on={t.id === playingId} onPress={() => play(favs, i)} />)
              )}
            </View>
          </View>
          <View style={styles.sec}>
            <Text style={[styles.sh, styles.pad]}>Artists</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hrow}>
              {people.map((a) => shelfTile(a, 92))}
            </ScrollView>
          </View>
          <View style={styles.sec}>
            <Text style={[styles.sh, styles.pad]}>Playlists</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hrow}>
              {lists.map((l) => shelfTile(l, 150))}
            </ScrollView>
          </View>
        </>
      )}
    </ScrollView>
  );

  return (
    <View style={styles.root}>
      <View style={[StyleSheet.absoluteFill, tab !== 0 && styles.hidden]} pointerEvents={tab === 0 ? 'auto' : 'none'}>
        {music}
      </View>
      <View style={[StyleSheet.absoluteFill, tab !== 1 && styles.hidden]} pointerEvents={tab === 1 ? 'auto' : 'none'}>
        {library}
      </View>
      <MiniPlayer bottom={insets.bottom + 18} folded={folded} />
      <StudyTabBar
        tab={tab}
        onTab={(i) => {
          Keyboard.dismiss();
          setTab(i);
          setFolded(false);
          setHits(null);
          if (q[i].trim()) onSearch(i, q[i]);
        }}
        folded={folded}
        onUnfold={() => setFolded(false)}
        bottom={insets.bottom + 18}
        items={[
          { icon: 'headphones', label: 'Music' },
          { icon: 'music.note.list', label: 'Library' },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GROUND },
  hidden: { opacity: 0 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingBottom: 6 },
  back: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'PlayfairDisplay_800ExtraBold_Italic', fontSize: 38, color: INK },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 6, height: 40, borderRadius: 12, paddingHorizontal: 12, backgroundColor: 'rgba(118,118,128,0.12)' },
  searchInput: { flex: 1, fontSize: 16, color: INK },
  sec: { marginTop: 24 },
  shRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, marginBottom: 10 },
  sh: { fontSize: 21, fontWeight: '700', color: INK, letterSpacing: -0.2 },
  pad: { paddingHorizontal: 20, marginBottom: 10 },
  shNote: { marginLeft: 'auto', fontSize: 13, color: MUTED },
  hrow: { gap: 12, paddingHorizontal: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, rowGap: 16, paddingHorizontal: 20 },
  card: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  empty: { color: MUTED, fontSize: 14, padding: 14 },
  notice: { color: MUTED, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginTop: 16 },
  pick: { width: 200, borderRadius: 20, overflow: 'hidden' },
  pickArt: { width: 200, height: 170 },
  pickFoot: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 14 },
  pickWhen: { fontSize: 12.5, color: 'rgba(255,255,255,0.8)' },
  pickTitle: { fontSize: 17, fontWeight: '700', color: '#fff', marginTop: 4 },
  pickArtist: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
});
