import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Footnote, Group } from '@/components/Group';
import { SheetHeader } from '@/components/SheetHeader';
import { usePalette } from '@/lib/colors';

// "Select" from a bubble's long-press menu: the text, free to pick any part of.
export default function SelectSheet() {
  const pal = usePalette();
  const { text } = useLocalSearchParams<{ text?: string }>();
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
      <SheetHeader title="Select" />
      <Group>
        <Text selectable style={[styles.text, { color: pal.ink }]}>
          {text}
        </Text>
      </Group>
      <Footnote>Press and hold, then drag the handles to pick the part you want.</Footnote>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 17, lineHeight: 26, padding: 18 },
});
