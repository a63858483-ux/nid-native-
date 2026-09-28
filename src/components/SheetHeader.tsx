import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Glass } from './Glass';
import { usePalette } from '@/lib/colors';

// Claude-app style: circular close (or back) on the left, big centered title.
export function SheetHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const pal = usePalette();
  return (
    <View style={styles.row}>
      <Pressable onPress={onBack ?? (() => router.back())} accessibilityLabel={onBack ? 'Back' : 'Close'} style={styles.btnWrap}>
        <Glass interactive style={styles.btn}>
          <SymbolView name={onBack ? 'chevron.left' : 'xmark'} size={16} weight="semibold" tintColor={pal.ink} />
        </Glass>
      </Pressable>
      <Text style={[styles.title, { color: pal.ink }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { height: 64, justifyContent: 'center', paddingHorizontal: 18, marginTop: 10 },
  btnWrap: { position: 'absolute', left: 18, zIndex: 2 },
  btn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', fontSize: 24, fontWeight: '800', letterSpacing: -0.4, marginHorizontal: 60 },
});
