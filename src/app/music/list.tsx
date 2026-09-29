import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GROUND, INK, MiniPlayer, MUTED, RED, shelfTile, TrackRow } from '@/components/music/Parts';
import * as M from '@/lib/music';
import { useApp } from '@/state/app';

// One playlist or album (its songs), or one artist (their albums in her library).
export default function MusicList() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { showToast } = useApp();
  const p = useLocalSearchParams<{ kind: 'playlist' | 'album' | 'artist'; id: string; name: string; art: string }>();
  const now = M.useNowPlaying(false);
  const [tracks, setTracks] = useState<M.Track[] | null>(null);
  const [albums, setAlbums] = useState<M.Shelf[] | null>(null);
  useEffect(() => {
    if (p.kind === 'artist') M.artistAlbums(p.id).then(setAlbums).catch(() => setAlbums([]));
    else (p.kind === 'album' ? M.albumTracks(p.id) : M.playlistTracks(p.id)).then(setTracks).catch(() => setTracks([]));
  }, [p.kind, p.id]);

  const play = async (i: number) => {
    if (!tracks) return;
    try {
      await M.playTracks(tracks, i);
    } catch {
      showToast("Couldn't play that one");
    }
  };
  const cover = p.art || tracks?.[0]?.artwork || '';
  const col = (width - 40 - 14) / 2;
  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: insets.bottom + 110 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityLabel="Back">
          <SymbolView name="chevron.left" size={17} weight="semibold" tintColor={INK} />
        </Pressable>
        {p.kind === 'artist' ? (
          <View style={styles.center}>
            <Image source={cover || undefined} style={styles.artistArt} contentFit="cover" />
            <Text style={styles.name}>{p.name}</Text>
          </View>
        ) : (
          <View style={styles.center}>
            <Image source={cover || undefined} style={styles.art} contentFit="cover" />
            <Text style={styles.name}>{p.name}</Text>
            {tracks && <Text style={styles.sub}>{tracks.length} songs</Text>}
            <Pressable onPress={() => play(0)} disabled={!tracks?.length} style={({ pressed }) => [styles.playAll, pressed && { opacity: 0.8 }]}>
              <SymbolView name="play.fill" size={15} tintColor="#fff" />
              <Text style={styles.playText}>Play</Text>
            </Pressable>
          </View>
        )}
        {p.kind === 'artist' ? (
          albums === null ? (
            <ActivityIndicator style={{ marginTop: 30 }} />
          ) : (
            <View style={styles.grid}>{albums.map((a) => shelfTile(a, col))}</View>
          )
        ) : tracks === null ? (
          <ActivityIndicator style={{ marginTop: 30 }} />
        ) : (
          <View style={styles.card}>
            {tracks.map((t, i) => (
              <TrackRow key={`${t.id}-${i}`} t={t} first={i === 0} on={t.id === now?.item?.songId} onPress={() => play(i)} />
            ))}
            {tracks.length === 0 && <Text style={styles.empty}>Nothing here yet.</Text>}
          </View>
        )}
      </ScrollView>
      <MiniPlayer bottom={insets.bottom - 60} folded={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GROUND },
  back: { width: 44, height: 40, marginLeft: 8, alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', paddingHorizontal: 30, marginBottom: 20 },
  art: { width: 230, height: 230, borderRadius: 12, backgroundColor: '#e7e4dd' },
  artistArt: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#e7e4dd' },
  name: { fontSize: 22, fontWeight: '700', color: INK, marginTop: 14, textAlign: 'center' },
  sub: { fontSize: 14, color: MUTED, marginTop: 2 },
  playAll: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, height: 44, paddingHorizontal: 34, borderRadius: 22, backgroundColor: RED },
  playText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: { marginHorizontal: 20, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, rowGap: 16, paddingHorizontal: 20 },
  empty: { color: MUTED, fontSize: 14, padding: 14 },
});
