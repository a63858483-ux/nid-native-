import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Footnote } from '@/components/Group';
import { SheetHeader } from '@/components/SheetHeader';
import * as api from '@/lib/api';
import { usePalette } from '@/lib/colors';
import { API_BASE } from '@/lib/config';
import { stickMarker } from '@/lib/markers';
import { useStickers } from '@/lib/stickers';
import { useChat } from '@/state/chat';

// Your sticker set from the web app. Tap one to send it.
export default function StickersSheet() {
  const pal = usePalette();
  const { send } = useChat();
  // Opened from a bubble's long-press menu: the sticker gets stuck onto that message instead of sent.
  const { stick, id, quote } = useLocalSearchParams<{ stick?: string; id?: string; quote?: string }>();
  const sticking = stick === '1';
  const list = useStickers(api.stickersList);
  const mine = (list ?? []).filter((s) => s.owner === 'user');
  const his = (list ?? []).filter((s) => s.owner !== 'user');
  const id_ = id;
  const pick = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
    const text = sticking ? stickMarker(id_ ? Number(id_) : undefined, quote ?? '', `sticker:${id}`) : `[sticker:${id}]`;
    setTimeout(() => send(text), 150);
  };
  const grid = (items: typeof mine) => (
    <View style={styles.grid}>
      {items.map((s) => (
        <Pressable key={s.id} onPress={() => pick(s.id)} style={({ pressed }) => [styles.cell, { backgroundColor: pal.fill }, pressed && { transform: [{ scale: 0.94 }] }]}>
          <Image source={API_BASE + (s.thumbnail || s.url)} style={styles.img} contentFit="contain" transition={120} />
        </Pressable>
      ))}
    </View>
  );
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <SheetHeader title={sticking ? 'Attach Sticker' : 'Stickers'} />
      {list === null ? (
        <ActivityIndicator style={{ marginTop: 30 }} />
      ) : (
        <>
          {mine.length > 0 && grid(mine)}
          {his.length > 0 && (
            <>
              <Text style={[styles.sec, { color: pal.ink2 }]}>HIS</Text>
              {grid(his)}
            </>
          )}
          {list.length === 0 && <Text style={[styles.empty, { color: pal.ink2 }]}>No stickers yet. Add some from the web app.</Text>}
        </>
      )}
      <Footnote>Emoji come from the keyboard as usual; one to three of them on their own show up big.</Footnote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  cell: { width: '30.5%', aspectRatio: 1, borderRadius: 18, padding: 8 },
  img: { flex: 1 },
  sec: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8, marginHorizontal: 20, marginTop: 8, marginBottom: 8 },
  empty: { textAlign: 'center', marginTop: 30, fontSize: 14 },
});
