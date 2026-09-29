import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DeviceEventEmitter, Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NidMusic } from '../../../modules/nid-music';
import * as M from '@/lib/music';
import { useApp } from '@/state/app';

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Full-screen player (her Apple Music screenshot): small cover and title on top, synced lyrics
// in the middle with the current line lit, then the progress bar and controls.
export default function Player() {
  const insets = useSafeAreaInsets();
  const { showToast } = useApp();
  const now = M.useNowPlaying(true);
  const item = now?.item;
  const dur = item?.duration || 0;
  const [lyrics, setLyrics] = useState<[number, string][] | null>(null);
  const [showLyrics, setShowLyrics] = useState(true);
  const [fav, setFav] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [barW, setBarW] = useState(1);
  const key = item ? `${item.title}|${item.artist}` : '';

  useEffect(() => {
    if (!item) return;
    let live = true;
    M.lyricsOf(item.title, item.artist || '', dur)
      .then((l) => live && setLyrics(l))
      .catch(() => live && setLyrics([]));
    if (item.songId) M.isFavourite(item.songId).then((f) => live && setFav(f));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const t = drag ?? now?.time ?? 0;
  const synced = !!lyrics?.length && lyrics[0][0] >= 0;
  const cur = useMemo(() => {
    if (!synced || !lyrics) return -1;
    let k = 0;
    lyrics.forEach(([at], i) => {
      if (at <= t) k = i;
    });
    return k;
  }, [lyrics, synced, t]);

  // Keep the current line about a quarter of the way down.
  const scroll = useRef<ScrollView>(null);
  const lineY = useRef<number[]>([]);
  const [boxH, setBoxH] = useState(0);
  useEffect(() => {
    if (cur < 0) return;
    const y = lineY.current[cur];
    if (y != null) scroll.current?.scrollTo({ y: Math.max(0, y - boxH * 0.22), animated: true });
  }, [cur, boxH]);

  const seekTo = (x: number) => Math.max(0, Math.min(1, x / barW)) * dur;
  const pan = Gesture.Pan()
    .minDistance(0)
    .runOnJS(true)
    .onBegin((e) => setDrag(seekTo(e.x)))
    .onUpdate((e) => setDrag(seekTo(e.x)))
    .onFinalize((e) => {
      NidMusic?.seek(seekTo(e.x));
      setTimeout(() => setDrag(null), 300);
    });

  const toggleFav = async () => {
    if (!item?.songId) return;
    Haptics.selectionAsync();
    try {
      const ok = await M.setFavourite(item.songId, !fav);
      if (!ok) return showToast('Favourites need the newer app build');
      setFav(!fav);
    } catch {
      showToast("Couldn't change that");
    }
  };
  const share = () => {
    if (!item) return;
    DeviceEventEmitter.emit(M.SHARE_SONG, { id: item.songId || item.id, title: item.title, artist: item.artist || '', artwork: item.artwork || '', color: item.color || '' });
    router.dismissTo('/');
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {item?.artwork ? <Image source={item.artwork} style={styles.bg} blurRadius={70} contentFit="cover" /> : null}
      <View style={[StyleSheet.absoluteFill, styles.shade]} />
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 14, paddingHorizontal: 26 }}>
        <Pressable onPress={() => router.back()} style={styles.grab} hitSlop={14} accessibilityLabel="Close player" />
        <View style={styles.head}>
          <Image source={item?.artwork || undefined} style={styles.small} contentFit="cover" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={styles.title}>
              {item?.title || 'Nothing playing'}
            </Text>
            <Text numberOfLines={1} style={styles.artist}>
              {item?.artist || ''}
            </Text>
          </View>
          <Pressable onPress={toggleFav} style={styles.circ} accessibilityLabel="Favourite">
            <SymbolView name={fav ? 'star.fill' : 'star'} size={16} tintColor="#fff" />
          </Pressable>
          <Pressable onPress={share} style={styles.circ} accessibilityLabel="Send to Antoine">
            <SymbolView name="paperplane" size={15} tintColor="#fff" />
          </Pressable>
        </View>

        {showLyrics ? (
          <ScrollView ref={scroll} style={styles.lyrics} showsVerticalScrollIndicator={false} onLayout={(e: LayoutChangeEvent) => setBoxH(e.nativeEvent.layout.height)}>
            <View style={{ height: 16 }} />
            {lyrics === null && <Text style={[styles.line, styles.dim]}>…</Text>}
            {lyrics?.length === 0 && <Text style={[styles.line, styles.dim]}>No lyrics for this one.</Text>}
            {lyrics?.map(([at, text], i) => (
              <Pressable
                key={i}
                disabled={at < 0}
                onLayout={(e) => (lineY.current[i] = e.nativeEvent.layout.y)}
                onPress={() => {
                  Haptics.selectionAsync();
                  NidMusic?.seek(at);
                }}>
                <Text style={[styles.line, synced && i !== cur && styles.dim, !synced && styles.plain]}>{text}</Text>
              </Pressable>
            ))}
            <View style={{ height: boxH * 0.6 }} />
          </ScrollView>
        ) : (
          <View style={styles.coverBox}>
            <Image source={item?.artwork || undefined} style={[styles.cover, !now?.playing && { transform: [{ scale: 0.86 }] }]} contentFit="cover" transition={200} />
          </View>
        )}

        <GestureDetector gesture={pan}>
          <View style={styles.barHit} onLayout={(e) => setBarW(e.nativeEvent.layout.width)}>
            <View style={[styles.bar, drag != null && styles.barBig]}>
              <View style={[styles.fill, { width: `${dur ? Math.min(100, (t / dur) * 100) : 0}%` }]} />
            </View>
          </View>
        </GestureDetector>
        <View style={styles.times}>
          <Text style={styles.time}>{fmt(t)}</Text>
          <Text style={styles.time}>-{fmt(Math.max(0, dur - t))}</Text>
        </View>

        <View style={styles.ctrls}>
          <Pressable onPress={() => (t > 3 ? NidMusic?.seek(0) : NidMusic?.previous().catch(() => {}))} hitSlop={10} accessibilityLabel="Previous">
            <SymbolView name="backward.fill" size={34} tintColor="#fff" />
          </Pressable>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              if (now?.playing) NidMusic?.pause();
              else NidMusic?.resume().catch(() => {});
            }}
            hitSlop={10}
            accessibilityLabel={now?.playing ? 'Pause' : 'Play'}>
            <SymbolView name={now?.playing ? 'pause.fill' : 'play.fill'} size={46} tintColor="#fff" />
          </Pressable>
          <Pressable onPress={() => NidMusic?.next().catch(() => {})} hitSlop={10} accessibilityLabel="Next">
            <SymbolView name="forward.fill" size={34} tintColor="#fff" />
          </Pressable>
        </View>

        <View style={styles.bottom}>
          <Pressable onPress={() => setShowLyrics((v) => !v)} style={[styles.bBtn, showLyrics && styles.bOn]} accessibilityLabel="Lyrics">
            <SymbolView name="quote.bubble" size={20} tintColor="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#222' },
  bg: { position: 'absolute', top: -80, left: -80, right: -80, bottom: -80 },
  shade: { backgroundColor: 'rgba(0,0,0,0.3)' },
  grab: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)', marginBottom: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  small: { width: 62, height: 62, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.15)' },
  title: { fontSize: 17, fontWeight: '700', color: '#fff' },
  artist: { fontSize: 15, color: 'rgba(255,255,255,0.7)' },
  circ: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  lyrics: { flex: 1, marginTop: 12, marginBottom: 10 },
  line: { fontSize: 29, lineHeight: 35, fontWeight: '700', color: '#fff', marginBottom: 22, letterSpacing: -0.2 },
  dim: { color: 'rgba(255,255,255,0.32)' },
  plain: { fontSize: 22, lineHeight: 30, color: 'rgba(255,255,255,0.85)' },
  coverBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cover: { width: '100%', maxWidth: 330, aspectRatio: 1, borderRadius: 12 },
  barHit: { height: 24, justifyContent: 'center' },
  bar: { height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  barBig: { height: 12, borderRadius: 6 },
  fill: { height: '100%', backgroundColor: 'rgba(255,255,255,0.85)' },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  time: { fontSize: 12, color: 'rgba(255,255,255,0.6)', fontVariant: ['tabular-nums'] },
  ctrls: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginVertical: 26, marginHorizontal: 20 },
  bottom: { flexDirection: 'row', justifyContent: 'center' },
  bBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', opacity: 0.75 },
  bOn: { backgroundColor: 'rgba(255,255,255,0.22)', opacity: 1 },
});
