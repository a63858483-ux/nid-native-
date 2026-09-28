import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from './Glass';
import { usePalette } from '@/lib/colors';
import { useApp } from '@/state/app';

export function Toast() {
  const { toast } = useApp();
  const insets = useSafeAreaInsets();
  const pal = usePalette();
  if (!toast) return null;
  return (
    <Animated.View entering={FadeInUp.springify()} exiting={FadeOutUp} style={[styles.wrap, { top: insets.top + 120 }]} pointerEvents="none">
      <Glass style={styles.pill}>
        <Text style={[styles.text, { color: pal.ink }]}>{toast}</Text>
      </Glass>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  pill: { borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9, maxWidth: '86%' },
  text: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
