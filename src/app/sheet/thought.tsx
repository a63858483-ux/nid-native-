import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Footnote, Group } from '@/components/Group';
import { SheetHeader } from '@/components/SheetHeader';
import { usePalette } from '@/lib/colors';
import { collapseSteps } from '@/lib/traces';
import { useChat } from '@/state/chat';

// Thought process: what he did (one line per real action) and what he thought.
export default function ThoughtSheet() {
  const pal = usePalette();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { items } = useChat();
  const it = items.find((i) => i.key === key);
  const steps = collapseSteps(it?.traces);
  const thinking = (it?.thinking || '').trim();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <SheetHeader title="Thought process" />
      {steps.length > 0 && (
        <Group>
          {steps.map((s, i) => (
            <View key={i} style={styles.step}>
              {i > 0 && <View style={[styles.sep, { backgroundColor: pal.line }]} />}
              <View style={[styles.icon, { backgroundColor: pal.fill }]}>
                <SymbolView name={s.icon} size={15} tintColor={pal.ink2} />
              </View>
              <Text style={[styles.stepText, { color: pal.ink }]}>{s.label}</Text>
            </View>
          ))}
        </Group>
      )}
      {thinking ? (
        <Group>
          <Text selectable style={[styles.text, { color: pal.ink }]}>
            {thinking}
          </Text>
        </Group>
      ) : steps.length === 0 ? (
        <Group>
          <Text style={[styles.text, { color: pal.ink2 }]}>Nothing here.</Text>
        </Group>
      ) : null}
      <Footnote>Only you can see this. It never goes into the conversation.</Footnote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 16 },
  sep: { position: 'absolute', top: 0, left: 58, right: 0, height: StyleSheet.hairlineWidth },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 16 },
  text: { fontSize: 16, lineHeight: 26, padding: 18 },
});
