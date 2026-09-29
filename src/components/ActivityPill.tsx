import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { usePalette } from '@/lib/colors';

// What he did on his own without saying anything: one quiet centred line with its time, set like the
// Today dividers. Four or more in a row fold into one line that opens to the list.
export function ActivityPill({ labels, times }: { labels: string[]; times: string[] }) {
  const pal = usePalette();
  const [open, setOpen] = useState(false);
  const fg = pal.wall ? 'rgba(255,255,255,0.85)' : pal.meta;
  const shade = pal.wall ? styles.shadow : null;
  if (labels.length === 1) {
    return (
      <Text style={[styles.line, { color: fg }, shade]}>
        {labels[0]} <Text style={styles.time}>{times[0]}</Text>
      </Text>
    );
  }
  return (
    <Animated.View layout={LinearTransition.duration(220)} style={styles.row}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setOpen((o) => !o);
        }}
        hitSlop={8}
        style={({ pressed }) => pressed && { opacity: 0.6 }}>
        <View style={styles.head}>
          <Text style={[styles.text, { color: fg }, shade]}>
            你不在的时候，他自己做了这些 · {labels.length} 件{' '}
            <Text style={styles.time}>
              {times[0]}–{times[times.length - 1]}
            </Text>
          </Text>
          <SymbolView name={open ? 'chevron.up' : 'chevron.down'} size={9} weight="semibold" tintColor={fg} />
        </View>
        {open && (
          <Animated.View entering={FadeIn.duration(180)} style={styles.list}>
            {labels.map((l, i) => (
              <Text key={i} style={[styles.item, { color: fg }, shade]}>
                {l} <Text style={styles.time}>{times[i]}</Text>
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
  row: { alignItems: 'center', paddingTop: 10, paddingBottom: 6, paddingHorizontal: 40 },
  line: { alignSelf: 'center', textAlign: 'center', fontSize: 11.5, fontWeight: '500', paddingTop: 10, paddingBottom: 6, paddingHorizontal: 40 },
  time: { fontWeight: '400', fontVariant: ['tabular-nums'] },
  shadow: { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  list: { paddingTop: 6, paddingBottom: 2, gap: 3 },
  item: { fontSize: 11.5, lineHeight: 17, textAlign: 'center' },
  text: { fontSize: 11.5, fontWeight: '500', textAlign: 'center' },
  call: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12, paddingHorizontal: 30 },
  hair: { flex: 1, height: StyleSheet.hairlineWidth, opacity: 0.6 },
  callText: { fontSize: 12, fontWeight: '500' },
});
