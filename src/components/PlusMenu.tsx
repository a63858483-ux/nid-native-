import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Glass } from './Glass';
import { usePalette } from '@/lib/colors';

export type PlusAction = 'photos' | 'model' | 'checklist' | 'toy' | 'bubble' | 'wallpaper';

const ITEMS: { key: PlusAction; label: string; icon: SFSymbol; color: string; note?: string }[] = [
  { key: 'photos', label: 'Photos & Files', icon: 'photo.on.rectangle', color: '#FF7A93' },
  { key: 'model', label: 'Model', icon: 'slider.horizontal.3', color: '#3A3A3C' },
  { key: 'checklist', label: 'Checklist', icon: 'checklist', color: '#F2A516' },
  { key: 'toy', label: 'Toy', icon: 'lock.fill', color: '#9160EB' },
  { key: 'bubble', label: 'Bubble', icon: 'paintpalette.fill', color: '#F58AA4' },
  { key: 'wallpaper', label: 'Wallpaper', icon: 'photo.artframe', color: '#4F9F7A' },
];

export function PlusMenu({
  open,
  bottom,
  note,
  onClose,
  onPick,
}: {
  open: boolean;
  bottom: number;
  note?: string;
  onClose: () => void;
  onPick: (a: PlusAction) => void;
}) {
  const pal = usePalette();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = open ? withSpring(1, { damping: 17, stiffness: 240, mass: 0.8 }) : withTiming(0, { duration: 160 });
  }, [open, p]);
  const panel = useAnimatedStyle(() => ({
    opacity: Math.min(1, p.value * 1.6),
    transform: [{ translateY: (1 - p.value) * 16 }, { scale: 0.55 + 0.45 * p.value }],
  }));
  const veil = useAnimatedStyle(() => ({ opacity: p.value }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veil]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.anchor, { bottom }, panel]}>
        <Glass style={styles.panel}>
          {ITEMS.map((it, i) => (
            <Pressable
              key={it.key}
              onPress={() => {
                Haptics.selectionAsync();
                onPick(it.key);
              }}
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: pal.fill }, (i === 1 || i === 4) && styles.gap]}>
              <View style={[styles.icon, { backgroundColor: it.color }]}>
                <SymbolView name={it.icon} size={20} tintColor="#fff" />
              </View>
              <Text style={[styles.label, { color: pal.ink }]}>{it.label}</Text>
              {it.key === 'model' && note ? <Text style={[styles.note, { color: pal.ink2 }]}>{note}</Text> : null}
            </Pressable>
          ))}
        </Glass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: 'rgba(0,0,0,0.08)' },
  anchor: { position: 'absolute', left: 12, width: 290, transformOrigin: 'left bottom' },
  panel: { borderRadius: 30, paddingVertical: 8, paddingHorizontal: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, height: 58, paddingHorizontal: 10, borderRadius: 20 },
  gap: { marginTop: 6 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 19, fontWeight: '500' },
  note: { marginLeft: 'auto', fontSize: 13 },
});
