import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Footnote, Group } from '@/components/Group';
import { SheetHeader } from '@/components/SheetHeader';
import { usePalette } from '@/lib/colors';
import { useChat } from '@/state/chat';

export default function ThoughtSheet() {
  const pal = usePalette();
  const { key } = useLocalSearchParams<{ key: string }>();
  const { items } = useChat();
  const it = items.find((i) => i.key === key);
  const secs = it?.thinkMs ? Math.max(1, Math.round(it.thinkMs / 1000)) : null;
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <SheetHeader title={secs ? `Thought for ${secs}s` : 'Thought process'} />
      <Group>
        <Text selectable style={[styles.text, { color: pal.ink }]}>
          {it?.thinking || 'Nothing here.'}
        </Text>
      </Group>
      <Footnote>Only you can see this. It never goes into the conversation.</Footnote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ text: { fontSize: 16, lineHeight: 26, padding: 18 } });
