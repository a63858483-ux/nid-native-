import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '@/lib/colors';

export function Group({ children }: { children: ReactNode }) {
  const pal = usePalette();
  return <View style={[styles.group, { backgroundColor: pal.card }]}>{children}</View>;
}

export function Row({
  title,
  subtitle,
  value,
  checked,
  chevron,
  first,
  onPress,
}: {
  title: string;
  subtitle?: string;
  value?: string;
  checked?: boolean;
  chevron?: boolean;
  first?: boolean;
  onPress?: () => void;
}) {
  const pal = usePalette();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: pal.fill }]}>
      {!first && <View style={[styles.sep, { backgroundColor: pal.line }]} />}
      <View style={styles.text}>
        <Text style={[styles.title, { color: pal.ink }]}>{title}</Text>
        {subtitle ? <Text style={[styles.sub, { color: pal.ink2 }]}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={[styles.value, { color: pal.ink2 }]}>{value}</Text> : null}
      {checked ? <SymbolView name="checkmark" size={18} weight="semibold" tintColor={pal.blue} /> : null}
      {chevron ? <SymbolView name="chevron.right" size={13} weight="semibold" tintColor={pal.ink2} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: 22, overflow: 'hidden', marginHorizontal: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 18, paddingVertical: 11 },
  sep: { position: 'absolute', top: 0, left: 18, right: 18, height: StyleSheet.hairlineWidth },
  text: { flex: 1, gap: 3 },
  title: { fontSize: 17 },
  sub: { fontSize: 14 },
  value: { fontSize: 16 },
});
