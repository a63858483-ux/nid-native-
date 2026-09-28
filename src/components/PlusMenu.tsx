import * as Haptics from 'expo-haptics';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Glass } from './Glass';
import { usePalette } from '@/lib/colors';

export type PlusAction = 'camera' | 'photos' | 'files' | 'model' | 'checklist' | 'bubble' | 'wallpaper';

const ITEMS: { key: PlusAction; label: string; icon: SFSymbol; color: string }[] = [
  { key: 'camera', label: 'Camera', icon: 'camera.fill', color: '#5E5E62' },
  { key: 'photos', label: 'Photos', icon: 'photo.on.rectangle', color: '#FF7A93' },
  { key: 'files', label: 'Files', icon: 'folder.fill', color: '#3B82F6' },
  { key: 'model', label: 'Model', icon: 'slider.horizontal.3', color: '#3A3A3C' },
  { key: 'checklist', label: 'Checklist', icon: 'checklist', color: '#F2A516' },
  { key: 'bubble', label: 'Bubble', icon: 'paintpalette.fill', color: '#F58AA4' },
  { key: 'wallpaper', label: 'Wallpaper', icon: 'photo.artframe', color: '#4F9F7A' },
];

const ROW = 66;

// iMessage's plus panel: anchored above the composer, rides up with the keyboard
// (the keyboard stays), and the row list scrolls if there is not enough room.
export function PlusMenu({
  open,
  bottom,
  topInset,
  note,
  onClose,
  onPick,
}: {
  open: boolean;
  bottom: number;
  topInset: number;
  note?: string;
  onClose: () => void;
  onPick: (a: PlusAction) => void;
}) {
  const pal = usePalette();
  const { height: screenH } = useWindowDimensions();
  const { height: kb } = useReanimatedKeyboardAnimation(); // 0 closed, -keyboardHeight open
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = open ? withSpring(1, { damping: 17, stiffness: 240, mass: 0.8 }) : withTiming(0, { duration: 160 });
  }, [open, p]);

  const wanted = ITEMS.length * ROW + 16;
  const panel = useAnimatedStyle(() => {
    const room = screenH - topInset - bottom + kb.value - 8;
    return {
      opacity: Math.min(1, p.value * 1.6),
      height: Math.max(ROW * 3, Math.min(wanted, room)),
      transform: [{ translateY: kb.value + (1 - p.value) * 16 }, { scale: 0.55 + 0.45 * p.value }],
    };
  });
  const veil = useAnimatedStyle(() => ({ opacity: p.value }));
  const ink = pal.chrome ? '#FFFFFF' : pal.ink;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={open ? 'auto' : 'none'}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.veil, veil]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.anchor, { bottom }, panel]}>
        <Glass style={styles.panel} tint={pal.chrome ? 'rgba(30,30,32,0.55)' : undefined}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}>
            {ITEMS.map((it, i) => (
              <Pressable
                key={it.key}
                onPress={() => {
                  Haptics.selectionAsync();
                  onPick(it.key);
                }}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: 'rgba(120,120,128,0.18)' }, (i === 3 || i === 5) && styles.gap]}>
                <View style={[styles.icon, { backgroundColor: it.color }]}>
                  <SymbolView name={it.icon} size={22} tintColor="#fff" />
                </View>
                <Text style={[styles.label, { color: ink }]}>{it.label}</Text>
                {it.key === 'model' && note ? <Text style={[styles.note, { color: pal.chrome ? 'rgba(255,255,255,0.6)' : pal.ink2 }]}>{note}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        </Glass>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: 'rgba(0,0,0,0.08)' },
  anchor: { position: 'absolute', left: 12, width: '72%', maxWidth: 320, transformOrigin: 'left bottom' },
  panel: { flex: 1, borderRadius: 34, overflow: 'hidden' },
  list: { paddingVertical: 8, paddingHorizontal: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, height: ROW, paddingHorizontal: 12, borderRadius: 24 },
  gap: { marginTop: 4 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 21, fontWeight: '500', letterSpacing: -0.2 },
  note: { marginLeft: 'auto', fontSize: 13 },
});
