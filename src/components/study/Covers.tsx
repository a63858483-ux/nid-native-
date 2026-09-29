import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Pattern, Rect, Stop } from 'react-native-svg';

import { authHeaders } from '@/lib/api';
import { bjDate, coverUrl, type Book, type Essay } from '@/lib/study';

const RATIO = 0.69;
export const SERIF = 'Songti SC';

// Darken a hex colour by mixing in black (the second stop of a generated cover).
function shade(hex: string, k = 0.7) {
  const v = parseInt(hex.replace('#', ''), 16);
  const c = (s: number) => Math.round(((v >> s) & 255) * k);
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}

// Spine: a darker band, a highlight, then the fold; plus a soft sheen across the face.
function Spine({ w, h, id }: { w: number; h: number; id: string }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id={`sp${id}`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#000" stopOpacity="0.35" />
          <Stop offset="0.45" stopColor="#fff" stopOpacity="0.18" />
          <Stop offset="0.7" stopColor="#000" stopOpacity="0.12" />
          <Stop offset="1" stopColor="#000" stopOpacity="0" />
        </LinearGradient>
        <LinearGradient id={`sh${id}`} x1="0" y1="0" x2="1" y2="0.55">
          <Stop offset="0" stopColor="#fff" stopOpacity="0.18" />
          <Stop offset="0.4" stopColor="#fff" stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={Math.max(8, w * 0.1)} height={h} fill={`url(#sp${id})`} />
      <Rect x="0" y="0" width={w} height={h} fill={`url(#sh${id})`} />
    </Svg>
  );
}

function Face({ w, h, color, id, grain }: { w: number; h: number; color: string; id: string; grain?: boolean }) {
  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={`bg${id}`} x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={color} />
          <Stop offset="1" stopColor={shade(color)} />
        </LinearGradient>
        <Pattern id={`gr${id}`} width="3" height="3" patternUnits="userSpaceOnUse">
          <Rect width="3" height="1" fill="#000" fillOpacity="0.5" />
        </Pattern>
      </Defs>
      <Rect width={w} height={h} fill={`url(#bg${id})`} />
      {grain && <Rect width={w} height={h} fill={`url(#gr${id})`} opacity={0.12} />}
    </Svg>
  );
}

const FALLBACK = '#8b6f5a';

export function BookCover({ book, width, onPress, onMore, dark }: { book: Book; width: number; onPress: () => void; onMore?: () => void; dark?: boolean }) {
  const h = width / RATIO;
  const img = coverUrl(book);
  const pct = Math.round(book.progress?.percent ?? 0);
  const small = width < 100;
  return (
    <View style={{ width }}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.shadow, { width, height: h }, pressed && styles.pressed]}>
        <View style={styles.cv}>
        {img ? (
          <Image source={{ uri: img, headers: authHeaders() }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <>
            <Face w={width} h={h} color={book.cover_color || FALLBACK} id={`b${book.id}`} />
            <View style={[styles.gen, small && styles.genSmall]}>
              <View>
                <Text style={[styles.gt, { fontSize: small ? 14 : 18 }]} numberOfLines={4}>
                  {book.title}
                </Text>
                <View style={styles.rule} />
              </View>
              {!!book.author && (
                <Text style={styles.ga} numberOfLines={2}>
                  {book.author}
                </Text>
              )}
            </View>
          </>
        )}
        <Spine w={width} h={h} id={`b${book.id}`} />
        </View>
      </Pressable>
      <View style={styles.meta}>
        <Text style={[styles.metaText, dark && styles.metaDark]}>{pct >= 100 ? 'Done' : pct > 0 ? `${pct}%` : 'New'}</Text>
        {onMore && (
          <Pressable onPress={onMore} hitSlop={10}>
            <Text style={[styles.metaText, dark && styles.metaDark]}>⋯</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

export function EssayCover({ essay, width, onPress, onMore, dark }: { essay: Essay; width: number; onPress: () => void; onMore?: () => void; dark?: boolean }) {
  const h = width / RATIO;
  const small = width < 100;
  const d = bjDate(essay.created_at);
  const r = essay.reply_count;
  return (
    <View style={{ width }}>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.shadow, { width, height: h }, pressed && styles.pressed]}>
        <View style={styles.cv}>
        <Face w={width} h={h} color={essay.cover_color || FALLBACK} id={`e${essay.id}`} grain />
        {essay.author === 'ta' && <View style={styles.tagTa} />}
        <View style={[styles.gen, small && styles.genSmall]}>
          <View>
            <Text style={[styles.gt, { fontSize: small ? 14 : 18 }]} numberOfLines={4}>
              {essay.title}
            </Text>
            <View style={styles.rule} />
          </View>
          <View>
            <Text style={styles.ga}>{essay.author === 'ta' ? '挞挞' : 'ANTOINE'}</Text>
            <Text style={styles.gd}>
              {String(d.m).padStart(2, '0')}·{String(d.d).padStart(2, '0')}
            </Text>
          </View>
        </View>
        <Spine w={width} h={h} id={`e${essay.id}`} />
        </View>
      </Pressable>
      <View style={styles.meta}>
        <Text style={[styles.metaText, dark && styles.metaDark]}>{r ? `${r} ${r > 1 ? 'replies' : 'reply'}` : ''}</Text>
        {onMore && (
          <Pressable onPress={onMore} hitSlop={10}>
            <Text style={[styles.metaText, dark && styles.metaDark]}>⋯</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 8 } },
  cv: {
    flex: 1,
    borderTopLeftRadius: 3,
    borderBottomLeftRadius: 3,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#b88a5e',
  },
  pressed: { transform: [{ scale: 0.96 }] },
  gen: { ...StyleSheet.absoluteFill, justifyContent: 'space-between', paddingTop: 14, paddingBottom: 12, paddingLeft: 18, paddingRight: 12 },
  genSmall: { paddingTop: 12, paddingBottom: 10, paddingLeft: 16, paddingRight: 10 },
  gt: { fontFamily: SERIF, fontWeight: '600', lineHeight: 20, color: 'rgba(255,250,240,0.95)' },
  rule: { height: 1, width: 28, marginVertical: 6, backgroundColor: 'rgba(255,250,240,0.45)' },
  ga: { fontFamily: 'JosefinSans_400Regular', fontSize: 9, letterSpacing: 1.6, color: 'rgba(255,250,240,0.85)' },
  gd: { fontFamily: 'PlayfairDisplay_600SemiBold', fontSize: 11, color: 'rgba(255,250,240,0.8)', marginTop: 2 },
  tagTa: { position: 'absolute', top: 8, right: 8, width: 7, height: 7, borderRadius: 4, backgroundColor: '#ff9fb2', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)', zIndex: 2 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6, minHeight: 15 },
  metaText: { fontSize: 11, color: 'rgba(235,235,245,0.66)', fontVariant: ['tabular-nums'] },
  metaDark: { color: '#8a857c' },
});
