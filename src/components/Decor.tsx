import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { TAIL_W } from './bubble-path';
import { inkOn, usePalette } from '@/lib/colors';
import type { Stick } from '@/lib/markers';
import type { Quote, TapbackView } from '@/lib/rows';
import { stickerUrl } from '@/lib/stickers';

// Tapbacks sit on the top corner away from the tail; stickers land wherever the marker says.
export function Decorated({
  mine,
  myColor,
  tapbacks,
  sticks,
  children,
}: {
  mine: boolean;
  myColor: string;
  tapbacks?: TapbackView[];
  sticks?: Stick[];
  children: ReactNode;
}) {
  const pal = usePalette();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const has = (tapbacks && tapbacks.length > 0) || (sticks && sticks.length > 0);
  return (
    <View style={[styles.wrap, mine ? styles.mine : styles.his, has && { marginTop: 14 }]} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      {children}
      {tapbacks && tapbacks.length > 0 && (
        <View style={[styles.tapbacks, mine ? { left: -8 } : { right: -8 }]} pointerEvents="none">
          {tapbacks.map((t, i) => {
            const bg = t.mine ? (myColor === 'glass' ? pal.blue : myColor) : pal.hisFill;
            return (
              <View key={i} style={[styles.tapback, { backgroundColor: bg, marginLeft: i ? -6 : 0 }]}>
                <Text style={styles.tapbackEmoji}>{t.emoji}</Text>
              </View>
            );
          })}
        </View>
      )}
      {box.w > 0 &&
        sticks?.map((s, i) => {
          const url = s.what.startsWith('sticker:') ? stickerUrl(s.what.slice(8)) : null;
          const size = url ? 64 : 40;
          return (
            <View
              key={i}
              pointerEvents="none"
              style={[styles.stick, { left: s.x * box.w - size / 2, top: s.y * box.h - size / 2, width: size, height: size, transform: [{ rotate: `${s.angle}deg` }] }]}>
              {url ? <Image source={url} style={{ width: size, height: size }} contentFit="contain" /> : <Text style={{ fontSize: 34, lineHeight: 40 }}>{s.what}</Text>}
            </View>
          );
        })}
    </View>
  );
}

// The little quoted bubble above a reply, with Messages' curved connector down to it.
export function ReplyQuote({ quote, replyMine, replies, onOpen }: { quote: Quote; replyMine: boolean; replies?: number; onOpen: () => void }) {
  const pal = usePalette();
  const quoteMine = quote.role === 'user';
  return (
    <View style={styles.quoteWrap}>
      <Pressable onPress={onOpen} style={[styles.quote, quoteMine ? styles.mine : styles.his, { backgroundColor: quoteMine ? pal.blue : pal.hisFill }]}>
        <Text numberOfLines={2} style={[styles.quoteText, { color: quoteMine ? '#fff' : pal.hisInk }]}>{quote.text}</Text>
      </Pressable>
      <View style={[styles.connectorRow, quoteMine ? { alignItems: 'flex-end' } : null]}>
        <Svg width={34} height={30} style={quoteMine ? { transform: [{ scaleX: -1 }] } : undefined}>
          <Path d={replyMine === quoteMine ? 'M14 0 V14 Q14 26 26 26 H34' : 'M14 0 V14 Q14 26 26 26 H34'} stroke={pal.meta} strokeOpacity={0.55} strokeWidth={2} fill="none" strokeLinecap="round" />
        </Svg>
        {replies ? (
          <Pressable onPress={onOpen} style={styles.repliesBtn}>
            <Text style={[styles.replies, { color: pal.meta }]}>{replies} {replies === 1 ? 'Reply' : 'Replies'}</Text>
            <SymbolView name="chevron.right" size={9} weight="bold" tintColor={pal.meta} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// "N Replies ›" under a message that has a thread.
export function RepliesLink({ count, mine, onOpen }: { count: number; mine: boolean; onOpen: () => void }) {
  const pal = usePalette();
  return (
    <Pressable onPress={onOpen} style={[styles.repliesBtn, mine ? { alignSelf: 'flex-end', marginRight: 16 } : { alignSelf: 'flex-start', marginLeft: 22 }]}>
      <Text style={[styles.replies, { color: pal.meta }]}>{count} {count === 1 ? 'Reply' : 'Replies'}</Text>
      <SymbolView name="chevron.right" size={9} weight="bold" tintColor={pal.meta} />
    </Pressable>
  );
}

export const inkFor = (mine: boolean, myColor: string, hisInk: string) => (mine && myColor !== 'glass' ? inkOn(myColor) : hisInk);

const styles = StyleSheet.create({
  wrap: { maxWidth: '76%' },
  mine: { alignSelf: 'flex-end' },
  his: { alignSelf: 'flex-start' },
  tapbacks: { position: 'absolute', top: -14, flexDirection: 'row' },
  tapback: { height: 26, minWidth: 30, paddingHorizontal: 7, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(0,0,0,0.15)' },
  tapbackEmoji: { fontSize: 14, lineHeight: 18 },
  stick: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  quoteWrap: { marginTop: 8, marginLeft: TAIL_W },
  quote: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 6, borderCurve: 'continuous' },
  quoteText: { fontSize: 13, lineHeight: 17 },
  connectorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 },
  repliesBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  replies: { fontSize: 13, fontWeight: '600' },
});
