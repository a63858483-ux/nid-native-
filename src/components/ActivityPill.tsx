import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { usePalette } from '@/lib/colors';

// What he did on his own without saying anything: a small centred grey pill. Four or more in a row
// fold into one pill that opens to the list.
export function ActivityPill({ labels }: { labels: string[] }) {
  const pal = usePalette();
  const [open, setOpen] = useState(false);
  const bg = pal.wall ? 'rgba(40,40,44,0.45)' : pal.fill;
  const fg = pal.wall ? 'rgba(255,255,255,0.9)' : pal.ink2;
  if (labels.length === 1) {
    return (
      <View style={styles.row}>
        <View style={[styles.pill, { backgroundColor: bg }]}>
          <Text style={[styles.text, { color: fg }]}>{labels[0]}</Text>
        </View>
      </View>
    );
  }
  return (
    <Animated.View layout={LinearTransition.duration(220)} style={styles.row}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setOpen((o) => !o);
        }}
        style={({ pressed }) => [styles.card, { backgroundColor: bg }, pressed && { opacity: 0.7 }]}>
        <View style={styles.head}>
          <Text style={[styles.text, { color: fg }]}>你不在的时候，他自己做了这些 · {labels.length} 件</Text>
          <SymbolView name={open ? 'chevron.up' : 'chevron.down'} size={10} weight="semibold" tintColor={fg} />
        </View>
        {open && (
          <Animated.View entering={FadeIn.duration(180)} style={styles.list}>
            {labels.map((l, i) => (
              <Text key={i} style={[styles.item, { color: fg }]}>
                · {l}
              </Text>
            ))}
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// "Call started" / "Call ended · 32:24" across the thread, a hairline either side.
export function CallDivider({ label }: { label: string }) {
  const pal = usePalette();
  const c = pal.wall ? 'rgba(255,255,255,0.75)' : pal.meta;
  return (
    <View style={styles.call}>
      <View style={[styles.hair, { backgroundColor: c }]} />
      <Text style={[styles.callText, { color: c }]}>{label}</Text>
      <View style={[styles.hair, { backgroundColor: c }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', marginVertical: 8, paddingHorizontal: 40 },
  pill: { borderRadius: 12, paddingHorizontal: 11, paddingVertical: 4 },
  card: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '100%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  list: { paddingTop: 6, paddingBottom: 2, gap: 3 },
  item: { fontSize: 12.5, lineHeight: 18 },
  text: { fontSize: 12.5 },
  call: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12, paddingHorizontal: 30 },
  hair: { flex: 1, height: StyleSheet.hairlineWidth, opacity: 0.6 },
  callText: { fontSize: 12, fontWeight: '500' },
});
