import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { NidMusic } from '../../../modules/nid-music';
import { useNowPlaying, type Shelf, type Track } from '@/lib/music';

export const INK = '#1b1a19';
export const MUTED = '#8a857c';
export const GROUND = '#f6f5f2';
export const RED = '#FA2D48';

export function TrackRow({ t, on, onPress, first }: { t: Track; on?: boolean; onPress: () => void; first?: boolean }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, !first && styles.rowLine, pressed && { backgroundColor: 'rgba(0,0,0,0.04)' }]}>
      <Image source={t.artwork || undefined} style={styles.rowArt} contentFit="cover" transition={120} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[styles.rowTitle, on && { color: RED }]}>
          {t.title}
        </Text>
        <Text numberOfLines={1} style={styles.rowSub}>
          {t.artist}
        </Text>
      </View>
      {on && <SymbolView name="waveform" size={15} tintColor={RED} />}
    </Pressable>
  );
}

export function Tile({ art, title, sub, size, round, onPress }: { art: string; title: string; sub?: string; size: number; round?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width: size }, pressed && { opacity: 0.7 }]}>
      <View style={[styles.tileArt, { width: size, height: size, borderRadius: round ? size / 2 : 10 }]}>
        {art ? (
          <Image source={art} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
        ) : (
          <SymbolView name={round ? 'music.mic' : 'music.note.list'} size={size * 0.3} tintColor={MUTED} />
        )}
      </View>
      <Text numberOfLines={1} style={[styles.tileTitle, round && { textAlign: 'center' }]}>
        {title}
      </Text>
      {!!sub && (
        <Text numberOfLines={1} style={styles.tileSub}>
          {sub}
        </Text>
      )}
    </Pressable>
  );
}

export const shelfTile = (s: Shelf, size: number) => (
  <Tile
    key={s.id}
    art={s.artwork}
    title={s.name}
    sub={s.sub}
    size={size}
    round={s.kind === 'artist'}
    onPress={() => router.push({ pathname: '/music/list', params: { kind: s.kind, id: s.id, name: s.name, art: s.artwork } })}
  />
);

// Floats above the tab bar; when the bar folds into its circle it slides down beside it.
export function MiniPlayer({ bottom, folded }: { bottom: number; folded: boolean }) {
  const now = useNowPlaying(false);
  const f = useSharedValue(folded ? 1 : 0);
  useEffect(() => {
    f.set(withSpring(folded ? 1 : 0, { damping: 18, stiffness: 170 }));
  }, [folded, f]);
  const st = useAnimatedStyle(() => ({ bottom: bottom + 78 * (1 - f.value), left: 16 + 74 * f.value }));
  const item = now?.item;
  if (!item) return null;
  return (
    <Animated.View style={[styles.mini, st]}>
      <BlurView tint="systemChromeMaterialLight" intensity={90} style={StyleSheet.absoluteFill} />
      <Pressable style={styles.miniIn} onPress={() => router.push('/music/player')} accessibilityLabel="Open player">
        <Image source={item.artwork || undefined} style={styles.miniArt} contentFit="cover" />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.miniTitle}>
            {item.title}
          </Text>
          <Text numberOfLines={1} style={styles.rowSub}>
            {item.artist}
          </Text>
        </View>
        <Pressable
          hitSlop={8}
          onPress={() => {
            Haptics.selectionAsync();
            if (now?.playing) NidMusic?.pause();
            else NidMusic?.resume().catch(() => {});
          }}
          style={styles.miniBtn}
          accessibilityLabel={now?.playing ? 'Pause' : 'Play'}>
          <SymbolView name={now?.playing ? 'pause.fill' : 'play.fill'} size={20} tintColor={INK} />
        </Pressable>
        <Pressable hitSlop={8} onPress={() => NidMusic?.next().catch(() => {})} style={styles.miniBtn} accessibilityLabel="Next">
          <SymbolView name="forward.fill" size={20} tintColor={INK} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 12 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(27,26,25,0.12)' },
  rowArt: { width: 44, height: 44, borderRadius: 6, backgroundColor: '#e7e4dd' },
  rowTitle: { fontSize: 15.5, fontWeight: '500', color: INK },
  rowSub: { fontSize: 13, color: MUTED, marginTop: 1 },
  tileArt: { overflow: 'hidden', backgroundColor: '#e7e4dd', alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 14, fontWeight: '500', color: INK, marginTop: 7 },
  tileSub: { fontSize: 13, color: MUTED },
  mini: {
    position: 'absolute',
    right: 16,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  miniIn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 8, paddingRight: 12 },
  miniArt: { width: 42, height: 42, borderRadius: 8, backgroundColor: '#e7e4dd' },
  miniTitle: { fontSize: 15, fontWeight: '600', color: INK },
  miniBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
