import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, DeviceEventEmitter, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { SheetHeader } from '@/components/SheetHeader';
import { usePalette } from '@/lib/colors';
import * as M from '@/lib/music';

// Messages' Music app: pick one of her recent songs (or search) to send to him.
export default function SongSheet() {
  const pal = usePalette();
  const [recent, setRecent] = useState<M.Track[] | null>(null);
  const [problem, setProblem] = useState('');
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<M.Track[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    M.recentTracks(20)
      .then(setRecent)
      .catch((e) => {
        setRecent([]);
        setProblem(e instanceof Error && e.message === 'needs-build' ? 'Update Nid from TestFlight to see what you played.' : 'Nid can’t see your music yet. Turn on Media & Apple Music for Nid douillet in Settings. You can still search.');
      });
  }, []);
  const onQ = (s: string) => {
    setQ(s);
    if (timer.current) clearTimeout(timer.current);
    if (!s.trim()) return setHits(null);
    timer.current = setTimeout(() => M.searchSongs(s.trim()).then(setHits).catch(() => setHits([])), 350);
  };
  const pick = (t: M.Track) => {
    Haptics.selectionAsync();
    DeviceEventEmitter.emit(M.SHARE_SONG, { id: t.id, title: t.title, artist: t.artist, artwork: t.artwork, color: t.color } satisfies M.SharedSong);
    router.back();
  };
  const list = q.trim() ? hits : recent;
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }} keyboardShouldPersistTaps="handled">
      <SheetHeader title={q.trim() ? 'Search' : 'Share Recently Played'} />
      <View style={[styles.search, { backgroundColor: pal.fill }]}>
        <SymbolView name="magnifyingglass" size={15} tintColor={pal.ink2} />
        <TextInput value={q} onChangeText={onQ} placeholder="Search Apple Music" placeholderTextColor={pal.ink2} style={[styles.input, { color: pal.ink }]} returnKeyType="search" autoCorrect={false} />
      </View>
      {!!problem && !q.trim() && <Text style={[styles.note, { color: pal.ink2 }]}>{problem}</Text>}
      {list === null && <ActivityIndicator style={{ marginTop: 30 }} />}
      <View style={styles.grid}>
        {list?.map((t, i) => (
          <Pressable key={`${t.id}-${i}`} onPress={() => pick(t)} style={({ pressed }) => [styles.cell, { backgroundColor: pal.card }, pressed && { opacity: 0.7 }]}>
            <Image source={t.artwork || undefined} style={styles.art} contentFit="cover" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[styles.title, { color: pal.ink }]}>
                {t.title}
              </Text>
              <Text numberOfLines={1} style={[styles.artist, { color: pal.ink2 }]}>
                {t.artist}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
      {list?.length === 0 && q.trim() && <Text style={[styles.note, { color: pal.ink2 }]}>No songs match. Try the artist’s name.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginBottom: 12, height: 38, borderRadius: 12, paddingHorizontal: 12 },
  input: { flex: 1, fontSize: 16 },
  note: { fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  cell: { width: '48.5%', flexGrow: 1, maxWidth: '50%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 16 },
  art: { width: 48, height: 48, borderRadius: 6, backgroundColor: 'rgba(118,118,128,0.2)' },
  title: { fontSize: 15 },
  artist: { fontSize: 13, marginTop: 1 },
});
