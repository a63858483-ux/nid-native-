import { ColorPicker, Host } from '@expo/ui/swift-ui';
import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Bubble } from '@/components/Bubble';
import { Group } from '@/components/Group';
import { SheetHeader } from '@/components/SheetHeader';
import { usePalette } from '@/lib/colors';
import { useApp } from '@/state/app';

const PRESETS = [
  { v: '#1982FC', n: 'Blue' },
  { v: '#34C759', n: 'Green' },
  { v: '#F7E2E6', n: 'Pale pink' },
  { v: '#F4D8DB', n: 'Rose' },
  { v: '#DCE9F4', n: 'Sky' },
  { v: 'glass', n: 'Frosted' },
];

export default function BubbleSheet() {
  const pal = usePalette();
  const { prefs, setPrefs } = useApp();
  const set = (v: string) => {
    Haptics.selectionAsync();
    setPrefs({ bubble: v });
  };
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <SheetHeader title="Bubble" />
      <View style={styles.preview}>
        <Bubble role="assistant" text="这个颜色好看。" tail myColor={prefs.bubble} />
        <View style={{ height: 6 }} />
        <Bubble role="user" text="那就用这个" tail myColor={prefs.bubble} />
      </View>
      <Group>
        <View style={styles.grid}>
          {PRESETS.map((p) => {
            const on = prefs.bubble.toLowerCase() === p.v.toLowerCase();
            return (
              <Pressable key={p.v} onPress={() => set(p.v)} style={[styles.swatch, { backgroundColor: pal.fill }, on && { borderColor: pal.ink }]}>
                <View style={[styles.dot, { backgroundColor: p.v === 'glass' ? pal.hisFill : p.v }]} />
                <Text style={[styles.swatchText, { color: pal.ink }]}>{p.n}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={[styles.custom, { borderTopColor: pal.line }]}>
          <Host matchContents>
            <ColorPicker label="Custom" selection={prefs.bubble === 'glass' ? '#1982FC' : prefs.bubble} onSelectionChange={(c) => setPrefs({ bubble: c.slice(0, 7) })} />
          </Host>
        </View>
      </Group>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  preview: { paddingHorizontal: 24, paddingVertical: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14 },
  swatch: { width: '31%', borderRadius: 16, paddingVertical: 12, alignItems: 'center', gap: 8, borderWidth: 2, borderColor: 'transparent' },
  dot: { width: 44, height: 28, borderRadius: 14 },
  swatchText: { fontSize: 12.5, fontWeight: '600' },
  custom: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 12 },
});
