import { SymbolView } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { TAIL_W } from './bubble-path';
import { usePalette } from '@/lib/colors';

export function ThoughtLine({ label, live, onPress }: { label: string; live: boolean; onPress: () => void }) {
  const pal = usePalette();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = live ? withRepeat(withTiming(0.35, { duration: 700 }), -1, true) : withTiming(1);
  }, [live, pulse]);
  const st = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Pressable onPress={onPress} disabled={live} hitSlop={8} style={({ pressed }) => [styles.row, pressed && { opacity: 0.5 }]}>
      <Animated.View style={st}>
        <SymbolView name="clock" size={13} tintColor={pal.meta} />
      </Animated.View>
      <Text style={[styles.label, { color: pal.meta }]}>{label}</Text>
      {!live && <SymbolView name="chevron.right" size={10} weight="semibold" tintColor={pal.meta} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: TAIL_W + 4, marginBottom: 4, alignSelf: 'flex-start' },
  label: { fontSize: 12.5, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
